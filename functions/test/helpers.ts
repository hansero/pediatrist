import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import { afterEach } from "vitest";
import type { MemberStatus, Role } from "../src/shared/constants";
import { SoftAuthenticator } from "./softAuthenticator";
import { beginAttendanceAssertion, beginDeviceRegistration, finishDeviceRegistration } from "../src/webauthn";

const PROJECT_ID = "demo-pediatrist";

/**
 * Firestore ve Auth emülatörlerindeki bütün veriyi siler ve ortam güvenlik ayarını emülatör değerine getirir
 * (`config/security.requireMfa = false`; Auth emülatörü TOTP desteklemiyor, D5). MFA testleri `setSecurityConfig`
 * ile açar. Doküman yoksa MFA zorunludur (güvenli varsayılan, N8).
 */
export async function resetEmulators() {
  const fs = `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const auth = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`;
  for (const url of [fs, auth]) {
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) throw new Error(`Emülatör sıfırlanamadı: ${url} (HTTP ${res.status})`);
  }
  await setSecurityConfig({ requireMfa: false });
}

/** `config/security` dokümanını yazar; `null` ise siler (güvenli varsayılan davranışı sınamak için). */
export async function setSecurityConfig(config: { requireMfa?: unknown } | null) {
  const ref = getFirestore().collection("config").doc("security");
  if (config === null) await ref.delete();
  else await ref.set(config);
}

export interface TestActor {
  uid: string;
  /** ID token claim'leri (role/status önbelleği, auth_time, email_verified, firebase.sign_in_second_factor ...). */
  claims?: Record<string, unknown>;
  /** App Check token'ı doğrulanmış gibi davran. */
  app?: boolean;
}

/** v2 callable'ın `.run()` kancası için istek nesnesi oluşturur. */
export function callableRequest<T>(data: T, actor?: TestActor): CallableRequest<T> {
  return {
    data,
    rawRequest: { headers: {}, ip: "127.0.0.1" } as unknown as CallableRequest<T>["rawRequest"],
    acceptsStreaming: false,
    app: actor?.app ? ({ appId: "test-app", token: {} } as unknown as CallableRequest<T>["app"]) : undefined,
    auth: actor
      ? {
          uid: actor.uid,
          rawToken: "test",
          token: {
            uid: actor.uid,
            auth_time: Math.floor(Date.now() / 1000),
            email: `${actor.uid}@example.test`,
            ...actor.claims,
          } as unknown as NonNullable<CallableRequest<T>["auth"]>["token"],
        }
      : undefined,
  } as CallableRequest<T>;
}

/** HttpsError kodunu (ve mesajını) yakalar; başarılıysa "ok". */
export async function errorOf(p: Promise<unknown>): Promise<{ code: string; message: string }> {
  try {
    await p;
    return { code: "ok", message: "" };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { code: err.code ?? "unknown", message: err.message ?? "" };
  }
}

export async function errorCode(p: Promise<unknown>): Promise<string> {
  return (await errorOf(p)).code;
}

/** Auth kullanıcısı + claim önbelleği + `users/{uid}` profili oluşturur. */
export async function createMember(uid: string, role: Role, status: MemberStatus, extra: Record<string, unknown> = {}) {
  await getAuth().createUser({ uid, email: `${uid}@example.test`, password: "Test-Sifre-123" });
  await getAuth().setCustomUserClaims(uid, { role, status, residencyYear: 1 });
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set({
      uid,
      role,
      status,
      residencyYear: 1,
      email: `${uid}@example.test`,
      title: role === "admin" ? "Prof. Dr." : "Asistan Dr.",
      fullName: `Test ${uid}`,
      ...extra,
    });
}

export const asAdmin = (uid = "admin"): TestActor => ({ uid, claims: { role: "admin", status: "active" } });
export const asMember = (uid: string): TestActor => ({ uid, claims: { role: "user", status: "active" } });

const ENFORCEMENT_VARS = ["ENFORCE_APP_CHECK", "REQUIRE_EMAIL_VERIFIED"] as const;

/** Testin süresince belirtilen zorunlulukları açar (afterEach geri alır). */
export function withEnforced(...names: (typeof ENFORCEMENT_VARS)[number][]) {
  for (const n of names) process.env[n] = "true";
}
afterEach(() => {
  for (const n of ENFORCEMENT_VARS) process.env[n] = "false";
});

export async function auditActions(): Promise<string[]> {
  const snap = await getFirestore().collection("audit_logs").get();
  return snap.docs.map((d) => String(d.data().action));
}

// --- WebAuthn (F4.2) -------------------------------------------------------------------------

/** Üyenin bu (yazılım) cihazını gerçek kayıt töreniyle yoklama cihazı olarak kaydeder. */
export async function registerDevice(uid: string, authenticator = new SoftAuthenticator()) {
  const { options } = await beginDeviceRegistration.run(callableRequest({}, asMember(uid)));
  await finishDeviceRegistration.run(callableRequest({ response: authenticator.register(options) }, asMember(uid)));
  return authenticator;
}

/** Yoklama için challenge alır ve cihazla imzalar (assertion). */
export async function attendanceAssertion(
  uid: string,
  sessionId: string,
  authenticator: SoftAuthenticator,
  overrides: Parameters<SoftAuthenticator["assert"]>[1] = {}
) {
  const { options } = await beginAttendanceAssertion.run(callableRequest({ sessionId }, asMember(uid)));
  return authenticator.assert(options, overrides);
}
