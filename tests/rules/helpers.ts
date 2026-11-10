import { readFileSync } from "node:fs";
import path from "node:path";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import firebaseJson from "../../firebase.json";

export const PROJECT_ID = "demo-pediatrist";
const root = path.resolve(import.meta.dirname, "..", "..");

/** firestore.rules ve storage.rules'u emülatöre yükleyen test ortamı. */
export async function createRulesEnv(): Promise<RulesTestEnvironment> {
  const { firestore, storage } = firebaseJson.emulators;
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: firestore.host,
      port: firestore.port,
      rules: readFileSync(path.join(root, "firestore.rules"), "utf8"),
    },
    storage: {
      host: storage.host,
      port: storage.port,
      rules: readFileSync(path.join(root, "storage.rules"), "utf8"),
    },
  });
}

type Status = "active" | "pending" | "suspended";
type Role = "admin" | "user";

/** Kural testleri için kullanıcı profili + aynı değerlerle custom claims. */
export interface TestMember {
  uid: string;
  role: Role;
  status: Status;
}

export const member = (uid: string, role: Role, status: Status): TestMember => ({ uid, role, status });

/**
 * Gerçekçi token: `@firebase/util` sahte token'ında `iat` verilmezse `auth_time` 0 (1970) olur;
 * gerçek Firebase token'larında `auth_time` her zaman oturum açma anıdır. Kurallar `auth_time`'ı
 * `tokensValidAfter` ile karşılaştırdığı için (F2.1) burada gerçek zaman verilir.
 */
export function claimsOf(m: TestMember) {
  const now = Math.floor(Date.now() / 1000);
  return { role: m.role, status: m.status, residencyYear: 2, iat: now, auth_time: now };
}

/** users/{uid} dokümanını kurallar devre dışıyken yazar. */
export async function seedMembers(
  env: RulesTestEnvironment,
  members: TestMember[],
  extra: Record<string, unknown> = {}
) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const m of members) {
      await db
        .collection("users")
        .doc(m.uid)
        .set({ uid: m.uid, role: m.role, status: m.status, residencyYear: 2, ...extra });
    }
  });
}

/**
 * `config/security` (N8, D20). Emülatör değeri `requireMfa: false` (Auth emülatörü TOTP desteklemiyor, D5);
 * `null` dokümanı siler (yoksa MFA zorunlu: güvenli varsayılan).
 */
export async function seedSecurityConfig(env: RulesTestEnvironment, config: { requireMfa?: unknown } | null) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const ref = ctx.firestore().collection("config").doc("security");
    if (config === null) await ref.delete();
    else await ref.set(config);
  });
}

/** İkinci faktörle (TOTP) açılmış oturumun token alanı. */
export const SECOND_FACTOR = { firebase: { sign_in_provider: "password", sign_in_second_factor: "totp" } };
