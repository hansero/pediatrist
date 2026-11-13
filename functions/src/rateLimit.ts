import { HttpsError } from "firebase-functions/v2/https";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { writeAuditLog } from "./auditLogger";
import { COLLECTIONS } from "./shared/types";

/**
 * Hız sınırı (F9.2, AUDIT S10): üye başına, işlem türüne göre sabit pencereli sayaç
 * (`rate_limits/{tür}_{uid}`; istemciye kapalı). Amaç, tahmin yoluyla deneme (yoklama kodu, davet kodu) ve
 * pahalı işlemlerin (veri dökümü) art arda çağrılmasını kesmek. Sınır aşılınca istek işlenmeden reddedilir ve
 * pencere başına BİR denetim kaydı düşer (kayıt seli olmaz).
 */
export const RATE_LIMITS = {
  /** Yoklama: kod gönderme. Dürüst kullanımda birkaç deneme yeter. */
  attendanceVerify: { limit: 10, windowMs: 60_000 },
  /** Kayıt tamamlama: davet kodu tahminini keser. */
  registration: { limit: 5, windowMs: 60_000 },
  /** Kişisel veri dökümü: çok sayıda okuma yapar. */
  dataExport: { limit: 5, windowMs: 60_000 },
} as const;
export type RateBucket = keyof typeof RATE_LIMITS;

/** Sayaç dokümanları pencere bittikten bu kadar sonra TTL ile silinir (`expireAt`). */
const CLEANUP_AFTER_MS = 24 * 3_600_000;

/** Testlerde saat ilerletilebilsin diye (pencere geçişi). */
export const rateClock = { now: () => Date.now() };

interface CounterDoc {
  windowStartMs: number;
  count: number;
  flagged?: boolean;
}

export async function enforceRateLimit(actor: { uid: string; email?: string | null }, bucket: RateBucket) {
  const { limit, windowMs } = RATE_LIMITS[bucket];
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.rateLimits).doc(`${bucket}_${actor.uid}`);
  const now = rateClock.now();

  const result = await db.runTransaction(async (tx) => {
    const current = (await tx.get(ref)).data() as CounterDoc | undefined;
    const fresh = !current || now - current.windowStartMs >= windowMs;
    const windowStartMs = fresh ? now : current.windowStartMs;
    const count = fresh ? 0 : current.count;
    const expireAt = Timestamp.fromMillis(windowStartMs + windowMs + CLEANUP_AFTER_MS);
    if (count >= limit) {
      const firstRejection = !current?.flagged;
      if (firstRejection) tx.set(ref, { uid: actor.uid, bucket, windowStartMs, count, flagged: true, expireAt });
      return { allowed: false as const, firstRejection, retryInMs: windowStartMs + windowMs - now };
    }
    tx.set(ref, { uid: actor.uid, bucket, windowStartMs, count: count + 1, flagged: false, expireAt });
    return { allowed: true as const };
  });

  if (result.allowed) return;
  if (result.firstRejection) {
    await writeAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email ?? "unknown",
      action: "RATE_LIMIT_EXCEEDED",
      resourceType: "auth",
      resourceId: actor.uid,
      severity: "WARN",
      metadata: { bucket, limit, windowSeconds: windowMs / 1000 },
    });
  }
  const seconds = Math.max(1, Math.ceil(result.retryInMs / 1000));
  throw new HttpsError("resource-exhausted", `Çok fazla deneme yapıldı. ${seconds} saniye sonra tekrar deneyin.`);
}
