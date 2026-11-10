/**
 * Firebase EMÜLATÖRLERİNE test verisi yükler (D1, D18).
 *
 * Güvenlik:
 * - Admin SDK'yı yalnızca `demo-` önekli proje kimliğiyle ve emülatör adresleriyle başlatır.
 *   Emülatör adresleri `firebase.json`'dan okunup bu süreçte zorla ayarlanır; ortamda
 *   emülatör dışı bir adres veya `demo-` önekli olmayan bir proje varsa çalışmayı reddeder.
 * - `GOOGLE_APPLICATION_CREDENTIALS` yok sayılır (gerçek bir hesaba bağlanma yolu kalmaz).
 *
 * Davranış: Varsayılan olarak emülatördeki Auth, Firestore ve Storage verisini SİLER ve
 * yeniden yükler (deterministik test başlangıcı). Silmeden eklemek için: `--no-reset`.
 *
 * Kullanım: `npm run emulators` (ayrı terminal) → `npm run seed`
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import firebaseJson from "../firebase.json";
import {
  SEED_ATTENDANCE,
  SEED_INVITATION,
  SEED_MATERIALS,
  SEED_PASSWORD,
  SEED_QUIZ_MEDIA,
  SEED_USERS,
  type SeedUser,
} from "./fixtures/seed-data";

const PROJECT_ID = "demo-pediatrist";
const BUCKET = `${PROJECT_ID}.appspot.com`;
const FILES_DIR = path.join(import.meta.dirname, "fixtures", "files");
const reset = !process.argv.includes("--no-reset");

const emu = firebaseJson.emulators;
const hosts = {
  FIRESTORE_EMULATOR_HOST: `${emu.firestore.host}:${emu.firestore.port}`,
  FIREBASE_AUTH_EMULATOR_HOST: `${emu.auth.host}:${emu.auth.port}`,
  FIREBASE_STORAGE_EMULATOR_HOST: `${emu.storage.host}:${emu.storage.port}`,
};

function fail(message: string): never {
  console.error(`\n✖ Seed iptal edildi: ${message}\n`);
  process.exit(1);
}

// --- 1) Ortam koruması ------------------------------------------------------
function isLocal(hostPort: string) {
  return /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(hostPort);
}
for (const [key, value] of Object.entries(hosts)) {
  const existing = process.env[key];
  if (existing && !isLocal(existing)) fail(`${key}=${existing} yerel bir emülatör adresi değil.`);
  process.env[key] = value;
}
for (const key of ["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT"]) {
  const existing = process.env[key];
  if (existing && !existing.startsWith("demo-")) fail(`${key}=${existing} 'demo-' önekli değil.`);
}
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
// Emülatörde GCE metadata sunucusunu yoklamaya gerek yok (gereksiz ağ çağrısı ve uyarı).
process.env.METADATA_SERVER_DETECTION = "none";
process.env.GCLOUD_PROJECT = PROJECT_ID;

async function assertEmulatorsRunning() {
  const hub = `http://${emu.hub.host}:${emu.hub.port}/emulators`;
  let running: Record<string, unknown>;
  try {
    const res = await fetch(hub);
    running = (await res.json()) as Record<string, unknown>;
  } catch {
    fail(`Emülatörlere ulaşılamadı (${hub}). Önce ayrı bir terminalde 'npm run emulators' çalıştırın.`);
  }
  const missing = ["auth", "firestore", "storage"].filter((name) => !(name in running));
  if (missing.length) fail(`Çalışmayan emülatör(ler): ${missing.join(", ")}.`);
  return "functions" in running;
}

// --- 2) Sıfırlama -------------------------------------------------------------
async function resetEmulators(bucket: { deleteFiles(options: { force: boolean }): Promise<unknown> }) {
  const fsBase = `http://${hosts.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const authBase = `http://${hosts.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`;
  for (const [name, url] of [
    ["Firestore", fsBase],
    ["Auth", authBase],
  ] as const) {
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) fail(`${name} emülatörü sıfırlanamadı (HTTP ${res.status}).`);
  }
  await bucket.deleteFiles({ force: true });
  console.log("• Emülatör verisi sıfırlandı (Auth, Firestore, Storage).");
}

async function main() {
  const functionsRunning = await assertEmulatorsRunning();

  // firebase-admin, emülatör ortam değişkenleri ayarlandıktan SONRA yüklenir.
  const { initializeApp } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore, Timestamp, FieldValue } = await import("firebase-admin/firestore");
  const { getStorage } = await import("firebase-admin/storage");

  const app = initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const bucket = getStorage(app).bucket();

  if (reset) await resetEmulators(bucket);

  const now = Date.now();
  const byUid = new Map<string, SeedUser>(SEED_USERS.map((u) => [u.uid, u]));
  const admin = SEED_USERS.find((u) => u.role === "admin" && u.status === "active");
  if (!admin) fail("Seed verisinde aktif admin yok.");

  // --- 3) Kullanıcılar: Auth + custom claims + users/{uid} -------------------
  for (const u of SEED_USERS) {
    await auth.createUser({
      uid: u.uid,
      email: u.email,
      password: SEED_PASSWORD,
      displayName: `${u.title} ${u.fullName}`,
      emailVerified: true,
      disabled: false,
    });
    await auth.setCustomUserClaims(u.uid, { role: u.role, status: u.status, residencyYear: u.residencyYear });
    await db
      .collection("users")
      .doc(u.uid)
      .set({
        uid: u.uid,
        title: u.title,
        fullName: u.fullName,
        email: u.email,
        residencyYear: u.residencyYear,
        role: u.role,
        status: u.status,
        boundDeviceHash: null,
        createdAt: Timestamp.fromMillis(now - 30 * 86_400_000),
        ...(u.status !== "pending" ? { approvedBy: admin.uid, updatedAt: FieldValue.serverTimestamp() } : {}),
      });
  }
  console.log(`• ${SEED_USERS.length} kullanıcı (Auth + claims + users).`);

  // --- 3b) Ortam güvenlik ayarı (N8, D20) -------------------------------------
  // Auth emülatörü TOTP desteklemediği için (D5) emülatörde MFA zorunluluğu kapatılır. Gerçek projede bu
  // doküman yoksa MFA zorunludur (güvenli varsayılan).
  await db.collection("config").doc("security").set({ requireMfa: false });
  console.log("• config/security: requireMfa = false (yalnızca emülatör).");

  // --- 4) Davet --------------------------------------------------------------
  const inv = SEED_INVITATION;
  await db
    .collection("invitations")
    .doc(inv.id)
    .set({
      code: inv.code,
      email: inv.email,
      intendedRole: inv.intendedRole,
      residencyYear: inv.residencyYear,
      invitedBy: admin.uid,
      createdAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + inv.validForDays * 86_400_000),
      used: false,
      revoked: false,
    });
  console.log("• 1 davet.");

  // --- 5) Storage dosyaları + materyaller ------------------------------------
  for (const m of SEED_MATERIALS) {
    const storagePath = `materials/${m.id}/${m.file.name}`;
    const data = readFileSync(path.join(FILES_DIR, m.file.local));
    await bucket.file(storagePath).save(data, { contentType: m.file.contentType, resumable: false });
    await db
      .collection("materials")
      .doc(m.id)
      .set({
        title: m.title,
        description: m.description,
        category: m.category,
        targetYears: m.targetYears,
        isMandatory: m.isMandatory,
        allowDownload: m.allowDownload,
        fileType: "pdf",
        storagePath,
        contentType: m.file.contentType,
        sizeBytes: data.byteLength,
        uploadedBy: admin.uid,
        uploadedByName: `${admin.title} ${admin.fullName}`,
        status: "published",
        createdAt: Timestamp.fromMillis(now - 7 * 86_400_000),
      });
  }
  for (const media of SEED_QUIZ_MEDIA) {
    const data = readFileSync(path.join(FILES_DIR, media.local));
    await bucket.file(media.path).save(data, { contentType: media.contentType, resumable: false });
  }
  console.log(`• ${SEED_MATERIALS.length} materyal (PDF) + ${SEED_QUIZ_MEDIA.length} sınav görseli (Storage).`);

  // --- 6) Kapanmış yoklama oturumu (attendanceService şeması) ---------------
  const a = SEED_ATTENDANCE;
  const startedAtMs = now - a.daysAgo * 86_400_000;
  const startedAt = Timestamp.fromMillis(startedAtMs);
  const sessionRef = db.collection("attendance_sessions").doc(a.id);
  const batch = db.batch();
  batch.set(sessionRef, {
    title: a.title,
    lecturer: a.lecturer,
    category: a.category,
    durationMinutes: a.durationMinutes,
    status: "closed",
    startedAt,
    endsAt: Timestamp.fromMillis(startedAtMs + a.durationMinutes * 60_000),
    startedBy: admin.uid,
    presentCount: a.records.filter((r) => r.status === "present").length,
    excusedCount: a.records.filter((r) => r.status === "excused").length,
    closedAt: Timestamp.fromMillis(startedAtMs + a.durationMinutes * 60_000),
    closedBy: admin.uid,
  });
  for (const r of a.records) {
    const u = byUid.get(r.uid);
    if (!u) fail(`Yoklama kaydındaki kullanıcı bulunamadı: ${r.uid}`);
    const record = {
      uid: u.uid,
      fullName: u.fullName,
      title: u.title,
      residencyYear: u.residencyYear,
      verifiedAt: Timestamp.fromMillis(startedAtMs + r.minuteOffset * 60_000),
      ...(r.status === "present"
        ? { method: "qr+device_bound", status: "present" }
        : { method: "admin_excused", status: "excused", excuseNote: r.excuseNote ?? "", markedBy: admin.uid }),
    };
    batch.set(sessionRef.collection("records").doc(u.uid), record);
    batch.set(db.collection("attendance_logs").doc(`${a.id}_${u.uid}`), {
      ...record,
      sessionId: a.id,
      sessionTitle: a.title,
      lecturer: a.lecturer,
      category: a.category,
      sessionStartedAt: startedAt,
    });
  }
  await batch.commit();
  console.log(`• 1 kapanmış yoklama oturumu (${a.records.length} kayıt).`);

  console.log(`
✔ Seed tamamlandı (proje: ${PROJECT_ID}).
  Ortak şifre: ${SEED_PASSWORD}
  Admin: ${admin.email}
  Diğer hesaplar: scripts/fixtures/README.md
  Sınavlar: F5.1'de callable'lar üzerinden eklenecek (bkz. REVISION_PLAN).${
    functionsRunning ? "" : "\n  ⚠ Functions emülatörü çalışmıyor; tetikleyiciler (ör. claim senkronu) devre dışı."
  }
`);
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
