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

type Writable = string | number | boolean | null | Date;

function toFirestoreValue(v: Writable): Record<string, unknown> {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  return { stringValue: v };
}

/** Test hazırlığı için emülatöre doküman yazar (kuralları atlar; yalnızca emülatörde geçerlidir). */
export async function writeDocument(path: string, data: Record<string, Writable>): Promise<void> {
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toFirestoreValue(v)]));
  const res = await fetch(`${BASE}/${path}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Doküman yazılamadı: ${path} (HTTP ${res.status})`);
}

/** Tek bir dokümanı düz değerlerle okur. */
export async function readDocument(path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BASE}/${path}`, { headers: { Authorization: "Bearer owner" } });
  if (res.status === 404) return null;
  const doc = (await res.json()) as { fields?: Record<string, FirestoreValue> };
  return Object.fromEntries(
    Object.entries(doc.fields ?? {}).map(([k, v]) => [
      k,
      v.stringValue ?? (v.integerValue !== undefined ? Number(v.integerValue) : (v.booleanValue ?? null)),
    ])
  );
}
