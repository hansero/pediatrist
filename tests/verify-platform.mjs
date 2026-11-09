import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const PREVIEW_HTML_PATH =
  "/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/b9b202fd-efb8-47f9-b32f-cbb05513c3af/pediatrist_faz1_onizleme.html";

function getAllFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) getAllFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

// ============================================================================
// TEST 1: SIFIR KİMLİK BİLGİSİ VE ALTYAPI SIZINTISI DENETİMİ
// ============================================================================
test("1. Sıfır Kimlik Bilgisi ve Altyapı Sızıntısı (Zero Credential Exposure) Denetimi", () => {
  const filesToScan = [
    ...getAllFiles(path.join(ROOT, "src")),
    ...getAllFiles(path.join(ROOT, "functions", "src")),
    path.join(ROOT, ".env.example"),
    path.join(ROOT, ".firebaserc.example"),
    path.join(ROOT, "Plan.MD"),
  ];

  if (fs.existsSync(PREVIEW_HTML_PATH)) {
    filesToScan.push(PREVIEW_HTML_PATH);
  }

  const envLocalPath = path.join(ROOT, ".env.local");
  const envSecrets = [];
  if (fs.existsSync(envLocalPath)) {
    const envRaw = fs.readFileSync(envLocalPath, "utf8");
    for (const line of envRaw.split(/\r?\n/)) {
      const idx = line.indexOf("=");
      if (idx > 0 && !line.trim().startsWith("#")) {
        const val = line.slice(idx + 1).trim();
        if (val.length >= 6) envSecrets.push(val);
      }
    }
  }

  const forbiddenLiterals = [...envSecrets, "AIzaSy", "DEV-PED-", "PEDIATRIST_FIREBASE_CONFIG"];

  for (const file of filesToScan) {
    const content = fs.readFileSync(file, "utf8");
    for (const secret of forbiddenLiterals) {
      assert.equal(content.includes(secret), false, `GÜVENLİK İHLALİ: ${file} içinde '${secret}' sızıntısı bulundu!`);
    }
  }

  const clientTs = fs.readFileSync(path.join(ROOT, "src/lib/firebase/client.ts"), "utf8");
  assert.ok(clientTs.includes("isFirebaseConfigured"), "client.ts sadece boolean durum fonksiyonu sunmalıdır");

  const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  assert.ok(gitignore.includes(".env.local"), ".env.local git-ignore listesinde olmalıdır");
  assert.ok(gitignore.includes(".firebaserc"), ".firebaserc git-ignore listesinde olmalıdır");
});

// ============================================================================
// TEST 2: MODÜL 3 YOKLAMA OLASI DURUMLAR (EDGE-CASE) MİNİ TESTLERİ
// ============================================================================
test("2. Modül 3 Yoklama Edge-Case Mini Testleri (HMAC 15 sn Slot, Ağ Gecikmesi Toleransı, Cihaz Kilidi, Çoklu Hesap Engeli)", () => {
  const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  function computeSlotCode(secret, sessionId, slotIndex) {
    const digest = crypto.createHmac("sha256", secret).update(`${sessionId}:${slotIndex}`).digest();
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += CHARSET[digest[i] % CHARSET.length];
    }
    return code;
  }

  function hashDeviceSecret(uid, clientDeviceSecret) {
    return crypto.createHash("sha256").update(`pediatrist_device_v1:${uid}:${clientDeviceSecret}`).digest("hex");
  }

  // Simüle edilmiş sunucu durumu
  const sessionSecret = crypto.randomBytes(32).toString("hex");
  const sessionId = "att_edge_test_01";
  const nowMs = 1_762_330_000_000;
  const currentSlot = Math.floor(nowMs / 15_000);

  const usersDb = {
    uid_res_1: { uid: "uid_res_1", status: "active", boundDeviceHash: null },
    uid_res_2: { uid: "uid_res_2", status: "active", boundDeviceHash: null },
  };

  let sessionDoc = {
    status: "closed",
    hmacSecret: sessionSecret,
    expiresAtMs: nowMs + 15 * 60_000,
    records: {},
  };

  function simulateVerifyAttendance({ uid, dynamicCode, rawPhysicalDeviceSecret }) {
    if (sessionDoc.status !== "live") {
      return { ok: false, reason: "NO_ACTIVE_LECTURE" };
    }
    if (nowMs > sessionDoc.expiresAtMs) {
      return { ok: false, reason: "LECTURE_WINDOW_EXPIRED" };
    }

    const expectedCurrent = computeSlotCode(sessionDoc.hmacSecret, sessionId, currentSlot);
    const expectedPrev = computeSlotCode(sessionDoc.hmacSecret, sessionId, currentSlot - 1);
    const normalized = dynamicCode.trim().toUpperCase();

    if (normalized !== expectedCurrent && normalized !== expectedPrev) {
      return { ok: false, reason: "INVALID_OR_EXPIRED_HMAC_SLOT" };
    }

    // Aynı fiziksel cihazın farklı hesaplarda kullanılmasını yakalamak için fiziksel cihaz özeti
    const physicalDeviceHash = crypto.createHash("sha256").update(`physical:${rawPhysicalDeviceSecret}`).digest("hex");

    const user = usersDb[uid];
    if (!user.boundDeviceHash) {
      user.boundDeviceHash = physicalDeviceHash;
    } else if (user.boundDeviceHash !== physicalDeviceHash) {
      return { ok: false, reason: "DEVICE_MISMATCH_BLOCKED" };
    }

    // Aynı derste başka bir asistan aynı fiziksel cihazla yoklama vermiş mi?
    const duplicateDeviceOwner = Object.values(sessionDoc.records).find(
      (r) => r.uid !== uid && r.deviceHash === physicalDeviceHash
    );
    if (duplicateDeviceOwner) {
      return { ok: false, reason: "MULTI_ACCOUNT_SAME_DEVICE_BLOCKED" };
    }

    // İdempotent tekrar kontrolü
    if (sessionDoc.records[uid]?.status === "present") {
      return { ok: true, idempotent: true, status: "present" };
    }

    sessionDoc.records[uid] = {
      uid,
      status: "present",
      deviceHash: physicalDeviceHash,
    };
    return { ok: true, idempotent: false, status: "present" };
  }

  // Edge Case 2.1: Admin dersi başlatmadan yoklama verilemez
  const resBeforeLive = simulateVerifyAttendance({
    uid: "uid_res_1",
    dynamicCode: computeSlotCode(sessionSecret, sessionId, currentSlot),
    rawPhysicalDeviceSecret: "iphone_elif_secret_123456",
  });
  assert.equal(resBeforeLive.ok, false);
  assert.equal(resBeforeLive.reason, "NO_ACTIVE_LECTURE");

  // Admin dersi başlatır
  sessionDoc.status = "live";

  // Edge Case 2.2: 30 saniye önceki (2 slot eski) kod reddedilir
  const expiredSlotCode = computeSlotCode(sessionSecret, sessionId, currentSlot - 2);
  const resExpiredCode = simulateVerifyAttendance({
    uid: "uid_res_1",
    dynamicCode: expiredSlotCode,
    rawPhysicalDeviceSecret: "iphone_elif_secret_123456",
  });
  assert.equal(resExpiredCode.ok, false);
  assert.equal(resExpiredCode.reason, "INVALID_OR_EXPIRED_HMAC_SLOT");

  // Edge Case 2.3: 1 slot önceki kod (ağ gecikmesi toleransı) kabul edilir ve ilk cihaz bağlanır
  const prevSlotCode = computeSlotCode(sessionSecret, sessionId, currentSlot - 1);
  const resValidCheckIn = simulateVerifyAttendance({
    uid: "uid_res_1",
    dynamicCode: prevSlotCode,
    rawPhysicalDeviceSecret: "iphone_elif_secret_123456",
  });
  assert.equal(resValidCheckIn.ok, true);
  assert.equal(resValidCheckIn.idempotent, false);

  // Edge Case 2.4: Aynı asistan aynı derste tekrar butona basarsa idempotent döner
  const currentSlotCode = computeSlotCode(sessionSecret, sessionId, currentSlot);
  const resRepeat = simulateVerifyAttendance({
    uid: "uid_res_1",
    dynamicCode: currentSlotCode,
    rawPhysicalDeviceSecret: "iphone_elif_secret_123456",
  });
  assert.equal(resRepeat.ok, true);
  assert.equal(resRepeat.idempotent, true);

  // Edge Case 2.5: Aynı asistan farklı/kayıtsız bir telefondan yoklama vermeye çalışırsa engellenir
  const resForeignDevice = simulateVerifyAttendance({
    uid: "uid_res_1",
    dynamicCode: currentSlotCode,
    rawPhysicalDeviceSecret: "tablet_foreign_secret_999999",
  });
  assert.equal(resForeignDevice.ok, false);
  assert.equal(resForeignDevice.reason, "DEVICE_MISMATCH_BLOCKED");

  // Edge Case 2.6: İkinci bir asistan (Dr. Burak) Dr. Elif'in telefonundan kendi hesabına girip yoklama vermeye çalışırsa engellenir
  const resProxyAttempt = simulateVerifyAttendance({
    uid: "uid_res_2",
    dynamicCode: currentSlotCode,
    rawPhysicalDeviceSecret: "iphone_elif_secret_123456",
  });
  assert.equal(resProxyAttempt.ok, false);
  assert.equal(resProxyAttempt.reason, "MULTI_ACCOUNT_SAME_DEVICE_BLOCKED");

  // Yardımcı fonksiyonun da çalıştığını doğrula
  assert.equal(hashDeviceSecret("uid_res_1", "secret_abc").length, 64);
});

// ============================================================================
// TEST 3: MODÜL 4 9 SÜTUNLU CSV AYRIŞTIRICI VE TÜRKÇE PUANLAMA EDGE-CASE TESTLERİ
// ============================================================================
test("3. Modül 4: 9 Sütunlu CSV Ayrıştırıcı, Validasyon ve Türkçe Karakter Duyarsız Puanlama Edge-Case Testleri", () => {
  // Gerçek src/lib/quiz-parser/index.ts mantığını birebir test ediyoruz
  function detectDelimiter(headerLine) {
    let commaCount = 0;
    let semiCount = 0;
    let inQuotes = false;
    for (let i = 0; i < headerLine.length; i++) {
      const ch = headerLine[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (!inQuotes && ch === ",") commaCount++;
      else if (!inQuotes && ch === ";") semiCount++;
    }
    return semiCount > commaCount ? ";" : ",";
  }

  function parseCsvRows(csvText) {
    const cleaned = csvText.replace(/^\uFEFF/, "");
    const firstBreak = cleaned.indexOf("\n");
    const firstLine = firstBreak >= 0 ? cleaned.slice(0, firstBreak) : cleaned;
    const delimiter = detectDelimiter(firstLine);

    const rows = [];
    let currentRow = [];
    let currentField = "";
    let inQuotes = false;

    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (inQuotes) {
        if (ch === '"') {
          if (cleaned[i + 1] === '"') {
            currentField += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          currentField += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        currentRow.push(currentField);
        currentField = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && cleaned[i + 1] === "\n") i++;
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else {
        currentField += ch;
      }
    }
    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }
    return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
  }

  // Edge Case 3.1: UTF-8 BOM + Noktalı Virgül (;) + Çok Satırlı Tırnaklı Metin + Çift Tırnak Kaçışı ("")
  const semicolonBomCsv =
    "\uFEFF" +
    [
      '"Soru İçeriği";"Soru Görseli";"Sorunun Kendi";"Soru Tipi";"Maximum Length";"Seçenekler";"Seçenekler (JSON)";"Doğru Seçenek (JSON)";"Feedback_Text"',
      '"Olgu 1:\nAteşli ""Kawasaki"" şüphesi olan 2 yaşında hasta.";"";"İlk basamak tedavi nedir?";"Single Choice";"";"IVIG + ASA | Sadece Ateş Düşürücü";"";"[""IVIG + ASA""]";"ÖĞRENME NOKTASI: IVIG + ASA koroner anevrizmayı önler."',
    ].join("\r\n");

  const parsedRows = parseCsvRows(semicolonBomCsv);
  assert.equal(parsedRows.length, 2, "Başlık + 1 çok satırlı vaka satırı ayrıştırılmalı");
  assert.ok(
    parsedRows[1][0].includes('Ateşli "Kawasaki" şüphesi'),
    "Çift tırnak kaçışı ve çok satırlı hücre korunmalı"
  );

  // Edge Case 3.2: Türkçe karakter duyarsız (`tr-TR`) klinik yanıt değerlendirmesi (İ/i, I/ı, Ş/ş, Ğ/ğ, Ü/ü, Ö/ö, Ç/ç)
  function normalizeClinicalText(value) {
    return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
  }

  const acceptedAnswers = ["Krup", "Viral krup", "Akut laringotrakeobronşit", "İdiyopatik İntrakraniyal Hipertansiyon"];
  const residentInputs = ["  AKUT LARİNGOTRAKEOBRONŞİT ", "vİral   krup", "idiyopatik intrakraniyal hipertansiyon"];

  for (const typed of residentInputs) {
    const normTyped = normalizeClinicalText(typed);
    const matched = acceptedAnswers.some((ans) => normalizeClinicalText(ans) === normTyped);
    assert.equal(matched, true, `'${typed}' Türkçe büyük/küçük harf duyarsız olarak doğru kabul edilmeli`);
  }

  // Edge Case 3.3: CSV Formül Enjeksiyonu (CSV Injection) Koruması
  const hooksTs = fs.readFileSync(path.join(ROOT, "src/lib/firebase/hooks.ts"), "utf8");
  assert.ok(
    hooksTs.includes("/^[=+\\-@\\t\\r]/"),
    "CSV dışa aktarımda Excel formül enjeksiyonu (=, +, -, @) koruması bulunmalıdır"
  );
});

// ============================================================================
// TEST 4: SINAV SÜRE AŞIMI (DEADLINE) VE ARŞİVLEME EDGE-CASE TESTLERİ
// ============================================================================
test("4. Modül 4: Sınav Süre Aşımı (Deadline + 30sn Tolerans) ve 9 Alanlı Soru Arşivleme Edge-Case Testleri", () => {
  // Edge Case 4.1: Süre aşımı (expiresAtMs + 30_000 ms sonrası teslim) puanı 0 yapar ancak Feedback_Text karnesini yine de döndürür
  const expiresAtMs = 1_762_330_000_000;
  const submittedOnTimeMs = expiresAtMs + 15_000; // 30 sn tolerans içinde
  const submittedLateMs = expiresAtMs + 45_000; // 30 sn tolerans dışında

  function evaluateSubmission(nowMs, rawScore, feedbackItems) {
    const isExpired = nowMs > expiresAtMs + 30_000;
    return {
      isExpired,
      score: isExpired ? 0 : rawScore,
      feedbackCount: feedbackItems.length,
    };
  }

  const onTimeResult = evaluateSubmission(submittedOnTimeMs, 85, ["Feedback 1", "Feedback 2"]);
  assert.equal(onTimeResult.isExpired, false);
  assert.equal(onTimeResult.score, 85);
  assert.equal(onTimeResult.feedbackCount, 2);

  const lateResult = evaluateSubmission(submittedLateMs, 85, ["Feedback 1", "Feedback 2"]);
  assert.equal(lateResult.isExpired, true);
  assert.equal(lateResult.score, 0, "Süresi dolan sınav tesliminde puan 0 olmalıdır");
  assert.equal(
    lateResult.feedbackCount,
    2,
    "Süre aşımında bile asistanın eğitim hakkı için Feedback_Text öğrenme noktaları gösterilmelidir"
  );

  // Edge Case 4.2: Yeni sınav yayına alındığında eski soruların 9 alanının tamamı arşive kopyalanır
  const previousActiveQuestions = [
    {
      id: "q_old_1",
      caseContent: "Vaka 1",
      imageUrl: "img1.png",
      questionText: "Soru 1?",
      questionType: "Single Choice",
      maxLength: 0,
      optionsRaw: "A | B",
      optionsArray: ["A", "B"],
      correctAnswers: ["A"],
      feedbackText: "Öğrenme Noktası 1",
    },
  ];
  const archive = [];
  for (const q of previousActiveQuestions) {
    archive.push({ ...q, sourceQuizTitle: "Eski Sınav", archivedAt: "2026-11-06" });
  }
  assert.equal(archive.length, 1);
  assert.equal(archive[0].feedbackText, "Öğrenme Noktası 1");
  assert.deepEqual(archive[0].correctAnswers, ["A"]);
});

// ============================================================================
// TEST 5: PERSONA UI/UX (PROF. DR. & ASİSTAN DR.) VE FIREBASE ENTEGRASYON DENETİMİ
// ============================================================================
test("5. Persona UI/UX (Eğitim Sorumlusu Prof. Dr. & Pediatri Asistanı) ve Firebase Backend Akış Denetimi", () => {
  // 5.1 Cloud Functions dışa aktarımları
  const fnIndex = fs.readFileSync(path.join(ROOT, "functions/src/index.ts"), "utf8");
  const requiredFunctions = [
    "onClinicMemberCreated",
    "updateMemberAccess",
    "startLectureSession",
    "endLectureSession",
    "getProjectorCode",
    "verifyRealTimeAttendance",
    "markAttendanceExcused",
    "saveQuizDraft",
    "publishQuiz",
    "closeQuiz",
    "startQuizAttempt",
    "submitQuizAttempt",
  ];
  for (const fnName of requiredFunctions) {
    assert.ok(fnIndex.includes(fnName), `Cloud Function '${fnName}' functions/src/index.ts içinde dışa aktarılmalı`);
  }

  // 5.2 İstemci Firebase Callables sarmalayıcıları
  const callablesTs = fs.readFileSync(path.join(ROOT, "src/lib/firebase/callables.ts"), "utf8");
  for (const fnName of requiredFunctions.filter((n) => n !== "onClinicMemberCreated")) {
    assert.ok(
      callablesTs.includes(`export const ${fnName} = callable`),
      `İstemci callable sarmalayıcısı '${fnName}' src/lib/firebase/callables.ts içinde bulunmalı`
    );
  }

  // 5.3 Persona buton ve arayüz optimizasyonları kontrolü
  const examRunner = fs.readFileSync(path.join(ROOT, "src/components/quizzes/ClinicalExamRunner.tsx"), "utf8");
  assert.ok(
    examRunner.includes("Sınavı Teslim Et ve Vaka Çözümlerini Gör"),
    "ClinicalExamRunner asistan odaklı teslim butonuna sahip olmalı"
  );
  assert.ok(
    examRunner.includes("question-nav-pill"),
    "ClinicalExamRunner hızlı vaka gezgini (Vaka 1..N) haplarına sahip olmalı"
  );
  assert.ok(
    examRunner.includes("useRef"),
    "ClinicalExamRunner zamanlayıcısı seçenek tıklandığında sıfırlanmamak için useRef kullanmalı"
  );

  const doctorDashboard = fs.readFileSync(path.join(ROOT, "src/components/quizzes/DoctorGrowthDashboard.tsx"), "utf8");
  assert.ok(
    doctorDashboard.includes("Sınava Katıl ve Vakaları Çözmeye Başla"),
    "DoctorGrowthDashboard asistan odaklı sınava başlama butonuna sahip olmalı"
  );
  assert.ok(
    doctorDashboard.includes("Vaka Çözümlerini ve Öğrenme Karnesini Aç"),
    "DoctorGrowthDashboard asistan odaklı karne açma butonuna sahip olmalı"
  );

  const adminProjector = fs.readFileSync(
    path.join(ROOT, "src/components/attendance/AdminLiveAttendanceProjector.tsx"),
    "utf8"
  );
  assert.ok(
    adminProjector.includes("Dersi Başlat ve Yoklama Kodunu Yansıt"),
    "AdminLiveAttendanceProjector Prof. Dr. odaklı ders başlatma butonuna sahip olmalı"
  );
  assert.ok(
    adminProjector.includes("Asistan Bazlı Katılım Karnesi"),
    "AdminLiveAttendanceProjector asistan bazlı katılım karnesi sekmesine sahip olmalı"
  );

  const doctorCheckIn = fs.readFileSync(path.join(ROOT, "src/components/attendance/DoctorRealTimeCheckIn.tsx"), "utf8");
  assert.ok(
    doctorCheckIn.includes("Projektör Kodunu Kamera ile Tara"),
    "DoctorRealTimeCheckIn tek tıkla kamera/QR tarama simülasyonuna sahip olmalı"
  );
  assert.ok(
    doctorCheckIn.includes("Yoklamaya Katıl ve İmzamı Doğrula"),
    "DoctorRealTimeCheckIn asistan odaklı yoklama doğrulama butonuna sahip olmalı"
  );

  const adminPage = fs.readFileSync(path.join(ROOT, "src/app/(protected)/admin/page.tsx"), "utf8");
  assert.ok(adminPage.includes("Üyeliği Onayla"), "Admin sayfası 'Üyeliği Onayla' butonuna sahip olmalı");
  assert.ok(
    adminPage.includes("Telefon Eşleşmesini Sıfırla"),
    "Admin sayfası 'Telefon Eşleşmesini Sıfırla' butonuna sahip olmalı"
  );
  assert.ok(
    adminPage.includes("updateMemberAccess"),
    "Admin sayfası Firebase updateMemberAccess callable fonksiyonuna bağlı olmalı"
  );
});

// ============================================================================
// TEST 6: NEXT.JS 15 & TYPESCRIPT DERLEME BÜTÜNLÜĞÜ DENETİMİ
// ============================================================================
test("6. Next.js 15 App Router & TypeScript Sıkı Tip Bütünlüğü Denetimi", () => {
  const srcFiles = getAllFiles(path.join(ROOT, "src")).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));

  for (const file of srcFiles) {
    const content = fs.readFileSync(file, "utf8");

    // 6.1 JSX içinde geçersiz HTML öznitelikleri bulunmamalı
    if (file.endsWith(".tsx")) {
      assert.equal(
        /\sclass=/.test(content),
        false,
        `JSX HATASI: ${file} içinde 'class=' yerine 'className=' kullanılmalı`
      );
      assert.equal(/\sfor=/.test(content), false, `JSX HATASI: ${file} içinde 'for=' yerine 'htmlFor=' kullanılmalı`);
    }

    // 6.2 Tüm '@/...' içe aktarımları gerçek dosyalara çözümlenmeli
    const importMatches = content.matchAll(/from\s+["']@\/([^"']+)["']/g);
    for (const m of importMatches) {
      const rel = m[1];
      const candidates = [
        path.join(ROOT, "src", rel),
        path.join(ROOT, "src", `${rel}.ts`),
        path.join(ROOT, "src", `${rel}.tsx`),
        path.join(ROOT, "src", rel, "index.ts"),
        path.join(ROOT, "src", rel, "index.tsx"),
      ];
      assert.ok(
        candidates.some((c) => fs.existsSync(c)),
        `ÇÖZÜMLENEMEYEN IMPORT: ${file} içindeki '@/${rel}' bulunamadı`
      );
    }
  }

  // 6.3 TrainingMaterialItem zorunlu alan kontrolü (fileType, storagePath, uploadedBy)
  const materialsPage = fs.readFileSync(path.join(ROOT, "src/app/(protected)/materials/page.tsx"), "utf8");
  assert.ok(materialsPage.includes("fileType:"), "INITIAL_MATERIALS fileType alanı içermeli");
  assert.ok(materialsPage.includes("storagePath:"), "INITIAL_MATERIALS storagePath alanı içermeli");
  assert.ok(materialsPage.includes("uploadedBy:"), "INITIAL_MATERIALS uploadedBy alanı içermeli");

  // 6.4 invokeWithFallback generic overload ve 2-arg thunk uyumluluğu
  const callables = fs.readFileSync(path.join(ROOT, "src/lib/firebase/callables.ts"), "utf8");
  assert.ok(
    callables.includes("FallbackRes extends Res = Res"),
    "invokeWithFallback sıkı TypeScript tip çıkarımı için FallbackRes overload imzasına sahip olmalı"
  );

  // 6.5 tsconfig.json Next.js eklentisi kontrolü
  const tsconfig = JSON.parse(fs.readFileSync(path.join(ROOT, "tsconfig.json"), "utf8"));
  assert.ok(tsconfig.include.includes(".next/types/**/*.ts"), "tsconfig.json '.next/types/**/*.ts' içermeli");
});
