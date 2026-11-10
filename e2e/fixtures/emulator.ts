import firebaseJson from "../../firebase.json";

/**
 * E2E testlerinden emülatör verisini doğrulamak için yardımcılar.
 * `Authorization: Bearer owner` yalnızca emülatörde geçerlidir ve kuralları atlar (yalnızca okuma için kullanılır).
 */
const { firestore } = firebaseJson.emulators;
const BASE = `http://${firestore.host}:${firestore.port}/v1/projects/demo-pediatrist/databases/(default)/documents`;

type FirestoreValue = { stringValue?: string; integerValue?: string; booleanValue?: boolean; nullValue?: null };

/** `users` koleksiyonunda e-postası eşleşen profili (alanları düz değerlerle) döndürür. */
export async function findUserProfileByEmail(email: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BASE}:runQuery`, {
    method: "POST",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "users" }],
        where: { fieldFilter: { field: { fieldPath: "email" }, op: "EQUAL", value: { stringValue: email } } },
        limit: 1,
      },
    }),
  });
  const rows = (await res.json()) as Array<{ document?: { fields: Record<string, FirestoreValue> } }>;
  const fields = rows[0]?.document?.fields;
  if (!fields) return null;
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [
      k,
      v.stringValue ?? (v.integerValue !== undefined ? Number(v.integerValue) : (v.booleanValue ?? null)),
    ])
  );
}
