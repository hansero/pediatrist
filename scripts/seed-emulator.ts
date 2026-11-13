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
  SEED_QUIZ,
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
const FIXTURES_DIR = path.join(import.meta.dirname, "fixtures");

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
interface SeedBucket {
  deleteFiles(options: { force: boolean }): Promise<unknown>;
  file(path: string): { save(data: Buffer, options: { contentType: string; resumable: boolean }): Promise<unknown> };
}

async function resetEmulators(bucket: SeedBucket) {
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

/**
 * Sınav seed'i: istemci SDK'sıyla emülatöre giriş yapılıp gerçek callable'lar çağrılır; yanıtlar ortak
 * sözleşmelerle (`CALLABLES`) doğrulanır. Döndürülen metin özet satırıdır.
 */
async function seedViaCallables(admin: SeedUser, bucket: SeedBucket): Promise<string[]> {
  const { initializeApp: initClientApp } = await import("firebase/app");
  const {
    connectAuthEmulator,
    getAuth: getClientAuth,
    signInWithEmailAndPassword,
    signOut,
  } = await import("firebase/auth");
  const { connectFunctionsEmulator, getFunctions, httpsCallable } = await import("firebase/functions");
  const { CALLABLES } = await import("../functions/src/shared/schemas");
  const { REGION } = await import("../functions/src/shared/constants");
  const { parseNineFieldQuizCsv } = await import("../functions/src/shared/quizCsv");
  type Name = keyof typeof CALLABLES;

  const app = initClientApp({ projectId: PROJECT_ID, apiKey: "demo-api-key" }, "seed-client");
  const clientAuth = getClientAuth(app);
  connectAuthEmulator(clientAuth, `http://${hosts.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const functions = getFunctions(app, REGION);
  connectFunctionsEmulator(functions, emu.functions.host, emu.functions.port);

  async function call<N extends Name>(name: N, data: unknown) {
    try {
      const res = await httpsCallable(functions, name)(data);
      return CALLABLES[name].response.parse(res.data) as import("zod").output<(typeof CALLABLES)[N]["response"]>;
    } catch (err) {
      throw new Error(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  async function as<T>(email: string, work: () => Promise<T>): Promise<T> {
    await signInWithEmailAndPassword(clientAuth, email, SEED_PASSWORD);
    try {
      return await work();
    } finally {
      await signOut(clientAuth);
    }
  }

  // Materyaller: createMaterial → dosya Storage'a (istemcinin yükleyeceği yola) → finalizeMaterialUpload.
  const materialIds = await as(admin.email, async () => {
    const ids: string[] = [];
    for (const m of SEED_MATERIALS) {
      const data = readFileSync(path.join(FILES_DIR, m.file.local));
      const created = await call("createMaterial", {
        title: m.title,
        description: m.description,
        labels: m.labels,
        targetYears: m.targetYears,
        targetSpecialists: m.targetSpecialists,
        isMandatory: m.isMandatory,
        allowDownload: m.allowDownload,
        fileName: m.file.name,
        contentType: m.file.contentType,
        sizeBytes: data.byteLength,
      });
      await bucket.file(created.storagePath).save(data, { contentType: m.file.contentType, resumable: false });
      await call("finalizeMaterialUpload", { materialId: created.materialId });
      ids.push(created.materialId);
    }
    return ids;
  });

  const parsed = parseNineFieldQuizCsv(readFileSync(path.join(FIXTURES_DIR, SEED_QUIZ.csvFile), "utf8"));
  if (parsed.errors.length) fail(`Sınav CSV'si geçersiz: ${parsed.errors[0].message}`);
  const q = SEED_QUIZ;

  const quizId = await as(admin.email, async () => {
    const draft = await call("saveQuizDraft", {
      title: q.title,
      durationMinutes: q.durationMinutes,
      revealPolicy: q.revealPolicy,
      sourceFileName: q.csvFile,
      questions: parsed.questions,
    });
    const pub = await call("publishQuiz", { quizId: draft.quizId });
    if (!pub.published) fail("Seed sınavı yayınlanamadı (devam eden girişim var).");
    return draft.quizId;
  });

  const scores: string[] = [];
  for (const attempt of q.attempts) {
    const user = SEED_USERS.find((u) => u.uid === attempt.uid);
    if (!user) fail(`Sınav girişimindeki kullanıcı bulunamadı: ${attempt.uid}`);
    const result = await as(user.email, async () => {
      const started = await call("startQuizAttempt", { quizId });
      const responses = Object.fromEntries(
        started.questions.map((question, i) => {
          const correctAnswers = parsed.questions[i].correctAnswers;
          if (attempt.correct[i]) return [question.questionId, correctAnswers];
          const wrong =
            question.questionType === "Text Input"
              ? "Bilmiyorum"
              : (question.options.find((o) => !correctAnswers.includes(o)) ?? question.options[0]);
          return [question.questionId, [wrong]];
        })
      );
      return call("submitQuizAttempt", { quizId, responses, tabSwitchCount: 0 });
    });
    scores.push(`${user.fullName} ${result.score}`);
  }

  await as(admin.email, async () => {
    await call("closeQuiz", { quizId });
    await call("saveQuizDraft", {
      title: q.draftTitle,
      durationMinutes: 15,
      sourceFileName: q.csvFile,
      questions: parsed.questions.slice(0, 1),
    });
  });
  return [
    `${materialIds.length} materyal (PDF; gerçek callable'larla, Storage'da doğrulanıp yayınlandı).`,
    `1 kapanmış sınav (gerçek callable'larla; puanlar: ${scores.join(", ")}) + 1 taslak sınav.`,
  ];
}

async function main() {
  const functionsRunning = await assertEmulatorsRunning();

  // firebase-admin, emülatör ortam değişkenleri ayarlandıktan SONRA yüklenir.
  const { initializeApp } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore, Timestamp, FieldValue } = await import("firebase-admin/firestore");
  const { getStorage } = await import("firebase-admin/storage");
  const { KVKK_NOTICE_VERSION } = await import("../functions/src/shared/consent");

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
        createdAt: Timestamp.fromMillis(now - 30 * 86_400_000),
        // Güncel aydınlatma metnini onaylamış sayılırlar (F9.1); onay ekranını e2e kendi üyesiyle sınar.
        consent: { version: KVKK_NOTICE_VERSION, acceptedAt: Timestamp.fromMillis(now - 30 * 86_400_000) },
        ...(u.status !== "pending" ? { approvedBy: admin.uid, updatedAt: FieldValue.serverTimestamp() } : {}),
      });
  }
  console.log(`• ${SEED_USERS.length} kullanıcı (Auth + claims + users).`);

  // --- 3b) Ortam güvenlik ayarı (N8, D20) -------------------------------------
  // Auth emülatörü TOTP desteklemediği için (D5) emülatörde MFA zorunluluğu kapatılır. Gerçek projede bu
  // doküman yoksa MFA zorunludur (güvenli varsayılan).
  // E-posta doğrulama zorunluluğu da emülatörde kapalıdır (D21); ilgili testler açıp kapatır.
  await db.collection("config").doc("security").set({ requireMfa: false, requireEmailVerified: false });
  console.log("• config/security: requireMfa = false, requireEmailVerified = false (yalnızca emülatör).");

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
  for (const media of SEED_QUIZ_MEDIA) {
    const data = readFileSync(path.join(FILES_DIR, media.local));
    await bucket.file(media.path).save(data, { contentType: media.contentType, resumable: false });
  }
  console.log(`• ${SEED_QUIZ_MEDIA.length} sınav görseli (Storage).`);

  // --- 6) Kapanmış yoklama oturumu (attendanceService şeması) ---------------
  const a = SEED_ATTENDANCE;
  const startedAtMs = now - a.daysAgo * 86_400_000;
  const startedAt = Timestamp.fromMillis(startedAtMs);
  const sessionRef = db.collection("attendance_sessions").doc(a.id);
  // Sunucuyla aynı kural (D24): yalnızca etkin 1.–4. yıl asistanlar beklenir.
  const { isAttendanceEligible } = await import("../functions/src/shared/constants");
  const expected = SEED_USERS.filter((u) => u.status === "active" && isAttendanceEligible(u));
  const absent = expected.filter((u) => !a.records.some((r) => r.uid === u.uid));
  const batch = db.batch();
  batch.set(sessionRef, {
    title: a.title,
    lecturer: a.lecturer,
    durationMinutes: a.durationMinutes,
    status: "closed",
    startedAt,
    endsAt: Timestamp.fromMillis(startedAtMs + a.durationMinutes * 60_000),
    startedBy: admin.uid,
    presentCount: a.records.filter((r) => r.status === "present").length,
    excusedCount: a.records.filter((r) => r.status === "excused").length,
    // D22: ders başındaki etkin hekimler ve kapanışta "katılmadı" yazılanların sayısı (sunucunun yaptığı gibi).
    expectedAttendees: expected.map((u) => u.uid),
    expectedCount: expected.length,
    absentCount: absent.length,
    closeReason: "manual",
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
        ? { method: "code", status: "present" }
        : { method: "admin_excused", status: "excused", excuseNote: r.excuseNote ?? "", markedBy: admin.uid }),
    };
    batch.set(sessionRef.collection("records").doc(u.uid), record);
    batch.set(db.collection("attendance_logs").doc(`${a.id}_${u.uid}`), {
      ...record,
      sessionId: a.id,
      sessionTitle: a.title,
      lecturer: a.lecturer,
      sessionStartedAt: startedAt,
    });
  }
  for (const u of absent) {
    const record = {
      uid: u.uid,
      fullName: u.fullName,
      title: u.title,
      residencyYear: u.residencyYear,
      verifiedAt: null,
      markedAt: Timestamp.fromMillis(startedAtMs + a.durationMinutes * 60_000),
      method: "system_absent",
      status: "absent",
    };
    batch.set(sessionRef.collection("records").doc(u.uid), record);
    batch.set(db.collection("attendance_logs").doc(`${a.id}_${u.uid}`), {
      ...record,
      sessionId: a.id,
      sessionTitle: a.title,
      lecturer: a.lecturer,
      sessionStartedAt: startedAt,
    });
  }
  await batch.commit();
  console.log(`• 1 kapanmış yoklama oturumu (${a.records.length} kayıt + ${absent.length} katılmadı).`);

  // --- 7) Materyaller ve sınavlar: GERÇEK callable'larla (F5.1, F6.1) ----------
  // Veri istemcinin yapacağı gibi üretilir (materyal: taslak → Storage'a yükleme → sunucuda doğrulama ve yayın;
  // sınav: taslak → yayın → giriş → sunucuda puanlama → kapanış). Firestore'a doğrudan yazılmaz; bu yüzden
  // Functions emülatörü gereklidir.
  if (!functionsRunning) {
    fail(
      "Materyal ve sınav verisi gerçek callable'larla yüklenir; Functions emülatörü çalışmıyor. 'npm run emulators' ile başlatın."
    );
  }
  for (const line of await seedViaCallables(admin, bucket)) console.log(`• ${line}`);

  console.log(`
✔ Seed tamamlandı (proje: ${PROJECT_ID}).
  Ortak şifre: ${SEED_PASSWORD}
  Admin: ${admin.email}
  Diğer hesaplar: scripts/fixtures/README.md
`);
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
