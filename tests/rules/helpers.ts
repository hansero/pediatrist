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

export function claimsOf(m: TestMember) {
  return { role: m.role, status: m.status, residencyYear: 2 };
}

/** users/{uid} dokümanını kurallar devre dışıyken yazar. */
export async function seedMembers(env: RulesTestEnvironment, members: TestMember[]) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const m of members) {
      await db.collection("users").doc(m.uid).set({ uid: m.uid, role: m.role, status: m.status, residencyYear: 2 });
    }
  });
}
