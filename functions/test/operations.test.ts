import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "firebase-functions";
import { getProjectorCode, startLectureSession, verifyRealTimeAttendance } from "../src/attendanceService";
import { auditRetentionDays } from "../src/auditLogger";
import { deleteMember, exportMemberData } from "../src/privacyService";
import { enforceRateLimit, RATE_LIMITS, rateClock } from "../src/rateLimit";
import { clientIp, hashIp } from "../src/requestContext";
import type { CallableRequest } from "firebase-functions/v2/https";
import { asAdmin, asMember, callableRequest, createMember, errorOf, resetEmulators } from "./helpers";

const db = () => getFirestore();
const DAY = 86_400_000;

/** Belirli bir ağdan (X-Forwarded-For) gelen istek. */
function from<T>(request: CallableRequest<T>, forwardedFor: string, userAgent = "Vitest/1.0"): CallableRequest<T> {
  return {
    ...request,
    rawRequest: { headers: { "x-forwarded-for": forwardedFor, "user-agent": userAgent }, ip: "10.0.0.1" },
  } as unknown as CallableRequest<T>;
}
const audits = async (action: string) =>
  (await db().collection("audit_logs").where("action", "==", action).get()).docs.map((d) => d.data());

beforeEach(async () => {
  await resetEmulators();
  await createMember("admin", "admin", "active");
  await createMember("r1", "user", "active");
});
afterEach(() => vi.restoreAllMocks());

describe("istemci IP'si ve tuzlu özet (F9.2)", () => {
  it("X-Forwarded-For'un SON değeri alınır (baştakiler istemcinin gönderdiği sahte değer olabilir)", () => {
    expect(clientIp({ headers: { "x-forwarded-for": "1.1.1.1, 203.0.113.7" }, ip: "10.0.0.1" })).toBe("203.0.113.7");
    expect(clientIp({ headers: { "x-forwarded-for": ["9.9.9.9", "198.51.100.4"] } })).toBe("198.51.100.4");
    expect(clientIp({ headers: {}, ip: "127.0.0.1" })).toBe("127.0.0.1");
    expect(clientIp(undefined)).toBeNull();
  });

  it("özet tuzludur ve kararlıdır; tuz yoksa ya da kısaysa özet üretilmez (tuzsuz özet geri çevrilebilir)", () => {
    const salt = "en-az-on-alti-karakterlik-tuz";
    const a = hashIp("203.0.113.7", salt);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(hashIp("203.0.113.7", salt)).toBe(a);
    expect(hashIp("203.0.113.8", salt)).not.toBe(a);
    expect(hashIp("203.0.113.7", `${salt}-baska`)).not.toBe(a);
    expect(a).not.toContain("203");
    expect(hashIp("203.0.113.7", "")).toBeNull();
    expect(hashIp("203.0.113.7", "kisa")).toBeNull();
    expect(hashIp(null, salt)).toBeNull();
  });
});

describe("denetim kaydı: saklama süresi ve istek bağlamı (F9.2)", () => {
  it("her kayıt expireAt (varsayılan 2 yıl), ağ özeti ve tarayıcı bilgisi taşır; ham IP yazılmaz", async () => {
    const before = Date.now();
    await exportMemberData.run(from(callableRequest({ targetUid: "r1" }, asMember("r1")), "1.2.3.4, 203.0.113.7"));
    const [log] = await audits("MEMBER_DATA_EXPORTED");
    expect(log.expireAt).toBeInstanceOf(Timestamp);
    const days = (log.expireAt.toMillis() - before) / DAY;
    expect(days).toBeGreaterThan(729.9);
    expect(days).toBeLessThan(730.1);
    expect(log.ipHash).toBe(hashIp("203.0.113.7"));
    expect(log.userAgent).toBe("Vitest/1.0");
    expect(JSON.stringify(log)).not.toContain("203.0.113.7");
  });

  it("saklama süresi ayarlanabilir; geçersiz ya da çok kısa değer varsayılana döner", () => {
    expect(auditRetentionDays("365")).toBe(365);
    expect(auditRetentionDays(undefined)).toBe(730);
    expect(auditRetentionDays("0")).toBe(730);
    expect(auditRetentionDays("7")).toBe(730);
    expect(auditRetentionDays("abc")).toBe(730);
    expect(auditRetentionDays("90.5")).toBe(730);
  });
});

describe("kritik olaylar Cloud Logging'e de düşer (alarm için, F9.2)", () => {
  it("üye silme: işaretli hata satırı yazılır, kişisel veri içermez; kritik olmayan işlemde yazılmaz", async () => {
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    await exportMemberData.run(callableRequest({ targetUid: "r1" }, asMember("r1")));
    expect(error).not.toHaveBeenCalled();

    await deleteMember.run(callableRequest({ targetUid: "r1" }, asAdmin()));
    expect(error).toHaveBeenCalledTimes(1);
    const [message, fields] = error.mock.calls[0];
    expect(message).toBe("Kritik denetim olayı");
    expect(fields).toEqual({
      audit: "CRITICAL",
      action: "MEMBER_DELETED",
      resourceType: "admin",
      resourceId: "r1",
      actorUid: "admin",
    });
    expect(JSON.stringify(error.mock.calls)).not.toMatch(/example\.test|Test r1/);
  });
});

describe("hız sınırı (F9.2)", () => {
  it("pencere içinde sınır kadar isteğe izin verir; fazlası reddedilir ve pencere başına tek denetim kaydı düşer", async () => {
    const { limit, windowMs } = RATE_LIMITS.dataExport;
    const t0 = 1_800_000_000_000;
    const clock = vi.spyOn(rateClock, "now").mockReturnValue(t0);
    const actor = { uid: "r1", email: "r1@example.test" };
    for (let i = 0; i < limit; i++) await enforceRateLimit(actor, "dataExport");

    clock.mockReturnValue(t0 + 20_000);
    const first = await errorOf(enforceRateLimit(actor, "dataExport"));
    expect(first).toEqual({
      code: "resource-exhausted",
      message: "Çok fazla deneme yapıldı. 40 saniye sonra tekrar deneyin.",
    });
    await errorOf(enforceRateLimit(actor, "dataExport"));
    await errorOf(enforceRateLimit(actor, "dataExport"));
    const logs = await audits("RATE_LIMIT_EXCEEDED");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actorUid: "r1", severity: "WARN", metadata: { bucket: "dataExport", limit } });

    // Başka üye ve başka işlem türü etkilenmez.
    await enforceRateLimit({ uid: "admin" }, "dataExport");
    await enforceRateLimit(actor, "attendanceVerify");

    // Pencere bitince yeniden izin verilir; sayaç dokümanı TTL için expireAt taşır.
    clock.mockReturnValue(t0 + windowMs);
    await enforceRateLimit(actor, "dataExport");
    const counter = (await db().doc("rate_limits/dataExport_r1").get()).data();
    expect(counter).toMatchObject({ count: 1, flagged: false, windowStartMs: t0 + windowMs });
    expect(counter?.expireAt).toBeInstanceOf(Timestamp);
  });

  it("callable'larda uygulanır: sınırı aşan veri dökümü ve yoklama kodu denemesi işlenmeden reddedilir", async () => {
    for (let i = 0; i < RATE_LIMITS.dataExport.limit; i++) {
      await exportMemberData.run(callableRequest({ targetUid: "r1" }, asMember("r1")));
    }
    const denied = await errorOf(exportMemberData.run(callableRequest({ targetUid: "r1" }, asMember("r1"))));
    expect(denied.code).toBe("resource-exhausted");
    expect(await audits("MEMBER_DATA_EXPORTED")).toHaveLength(RATE_LIMITS.dataExport.limit);

    const { sessionId } = await startLectureSession.run(
      callableRequest({ title: "Ders", lecturer: "Dr. X", durationMinutes: 15 }, asAdmin())
    );
    // Yanlış kod tahmini: sınıra kadar "geçersiz kod", sonrası işlenmeden red (doğru kod da olsa).
    const guess = () =>
      errorOf(verifyRealTimeAttendance.run(callableRequest({ sessionId, code: "AAAAAA" }, asMember("r1"))));
    for (let i = 0; i < RATE_LIMITS.attendanceVerify.limit; i++) {
      expect(["deadline-exceeded", "ok"]).toContain((await guess()).code);
    }
    expect((await guess()).code).toBe("resource-exhausted");
  });
});

describe("projektör ağı (AUDIT S2, F9.2)", () => {
  it("projektör ekranının ağ özeti gizli dokümanda tutulur ve yalnızca değişince yazılır", async () => {
    const { sessionId } = await startLectureSession.run(
      callableRequest({ title: "Ders", lecturer: "Dr. X", durationMinutes: 15 }, asAdmin())
    );
    await getProjectorCode.run(from(callableRequest({ sessionId }, asAdmin()), "203.0.113.7"));
    const secret = db().doc(`attendance_secrets/${sessionId}`);
    const first = await secret.get();
    expect(first.data()?.projectorIpHash).toBe(hashIp("203.0.113.7"));

    await getProjectorCode.run(from(callableRequest({ sessionId }, asAdmin()), "203.0.113.7"));
    expect((await secret.get()).updateTime?.isEqual(first.updateTime!)).toBe(true);

    await getProjectorCode.run(from(callableRequest({ sessionId }, asAdmin()), "198.51.100.4"));
    expect((await secret.get()).data()?.projectorIpHash).toBe(hashIp("198.51.100.4"));
  });
});
