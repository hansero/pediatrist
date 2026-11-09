import type { CallableRequest } from "firebase-functions/v2/https";

const PROJECT_ID = "demo-pediatrist";

/** Firestore ve Auth emülatörlerindeki bütün veriyi siler. */
export async function resetEmulators() {
  const fs = `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const auth = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`;
  for (const url of [fs, auth]) {
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) throw new Error(`Emülatör sıfırlanamadı: ${url} (HTTP ${res.status})`);
  }
}

type Claims = { role?: string; status?: string; email?: string };

/** v2 callable'ın `.run()` kancası için istek nesnesi oluşturur. */
export function callableRequest<T>(data: T, auth?: { uid: string; claims?: Claims }): CallableRequest<T> {
  return {
    data,
    rawRequest: { headers: {}, ip: "127.0.0.1" } as unknown as CallableRequest<T>["rawRequest"],
    acceptsStreaming: false,
    auth: auth
      ? {
          uid: auth.uid,
          rawToken: "test",
          token: { uid: auth.uid, ...auth.claims } as unknown as NonNullable<CallableRequest<T>["auth"]>["token"],
        }
      : undefined,
  } as CallableRequest<T>;
}

/** HttpsError kodunu yakalar (ör. "permission-denied"). */
export async function errorCode(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "ok";
  } catch (e) {
    return (e as { code?: string }).code ?? "unknown";
  }
}
