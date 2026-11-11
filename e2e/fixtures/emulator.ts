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

/** Auth emülatörünün gönderdiği e-posta eylem kodları (şifre sıfırlama, e-posta doğrulama). */
export async function listOobCodes(): Promise<
  Array<{ email: string; requestType: string; oobLink: string; oobCode: string }>
> {
  const { auth } = firebaseJson.emulators;
  const res = await fetch(`http://${auth.host}:${auth.port}/emulator/v1/projects/demo-pediatrist/oobCodes`);
  return (
    (
      (await res.json()) as {
        oobCodes?: Array<{ email: string; requestType: string; oobLink: string; oobCode: string }>;
      }
    ).oobCodes ?? []
  );
}

/** Dokümandan tek bir alanı siler (diğer alanlara dokunmaz). Testlerin seed hesabını başlangıç durumuna getirmesi için. */
export async function deleteField(path: string, field: string): Promise<void> {
  const res = await fetch(`${BASE}/${path}?updateMask.fieldPaths=${encodeURIComponent(field)}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: {} }),
  });
  if (!res.ok) throw new Error(`Alan silinemedi: ${path}.${field} (HTTP ${res.status})`);
}

/** Dokümanda alan var mı? (iç içe değerleri çözmeden) */
export async function hasField(path: string, field: string): Promise<boolean> {
  const res = await fetch(`${BASE}/${path}`, { headers: { Authorization: "Bearer owner" } });
  if (!res.ok) return false;
  const doc = (await res.json()) as { fields?: Record<string, unknown> };
  return Boolean(doc.fields && field in doc.fields);
}

/** Auth emülatöründe bir e-posta eylem kodunu uygular (kullanıcının e-postadaki bağlantıya tıklaması gibi). */
export async function applyOobCode(oobCode: string): Promise<void> {
  const { auth } = firebaseJson.emulators;
  const res = await fetch(
    `http://${auth.host}:${auth.port}/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-api-key`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oobCode }) }
  );
  if (!res.ok) throw new Error(`Eylem kodu uygulanamadı (HTTP ${res.status})`);
}

/**
 * Önceki (yarım kalmış) bir koşudan kalan canlı dersleri kapatır ve tek canlı ders kilidini siler,
 * böylece yoklama testi temiz başlar. Yalnızca emülatör (owner token).
 */
export async function closeLiveLectures(): Promise<void> {
  const res = await fetch(`${BASE}:runQuery`, {
    method: "POST",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "attendance_sessions" }],
        where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "live" } } },
      },
    }),
  });
  const rows = (await res.json()) as Array<{ document?: { name: string } }>;
  for (const row of rows) {
    if (!row.document) continue;
    const path = row.document.name.split("/documents/")[1];
    await fetch(`${BASE}/${path}?updateMask.fieldPaths=status`, {
      method: "PATCH",
      headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { status: { stringValue: "closed" } } }),
    });
  }
  await fetch(`${BASE}/attendance_meta/live`, { method: "DELETE", headers: { Authorization: "Bearer owner" } });
}

/** Bir kaynak için belirli eylemdeki denetim kaydı sayısı (sunucunun reddi gerçekten işlediğini doğrulamak için). */
export async function countAuditLogs(action: string, resourceId: string): Promise<number> {
  const res = await fetch(`${BASE}:runQuery`, {
    method: "POST",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "audit_logs" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              { fieldFilter: { field: { fieldPath: "action" }, op: "EQUAL", value: { stringValue: action } } },
              { fieldFilter: { field: { fieldPath: "resourceId" }, op: "EQUAL", value: { stringValue: resourceId } } },
            ],
          },
        },
      },
    }),
  });
  const rows = (await res.json()) as Array<{ document?: unknown }>;
  return rows.filter((r) => r.document).length;
}
