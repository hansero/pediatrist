export type QuizQuestionType = "Single Choice" | "Multiple Choice" | "Text Input";

/**
 * Standart 9 Alanlı (A–I) Klinik Vaka Soru Veri Modeli (Firestore Native)
 */
export interface NineFieldClinicalQuestion {
  id: string;
  orderIndex: number;
  caseContent: string;         // 1 (A): Soru İçeriği (Klinik Vaka Sunumu ve Hasta Öyküsü)
  imageUrl: string;            // 2 (B): Soru Görseli (Firebase Cloud Storage Görsel Yolu / URL)
  questionText: string;        // 3 (C): Sorunun Kendi (Vakanın altındaki doğrudan soru cümlesi)
  questionType: QuizQuestionType; // 4 (D): Soru Tipi (Single Choice | Multiple Choice | Text Input)
  maxLength: number;           // 5 (E): Maximum Length (Text Input için karakter sınırı)
  optionsRaw: string;          // 6 (F): Seçenekler ( | ile ayırın)
  optionsArray: string[];      // 7 (G): Seçenekler (JSON Array - sistem tarafından otomatik dönüştürülür)
  correctAnswers: string[];    // 8 (H): Doğru Seçenek (JSON Array - tekli/çoklu/açık uçlu varyasyonlar)
  feedbackText: string;        // 9 (I): Feedback_Text (Doğru/yanlış bağımsız pedagojik Öğrenme Noktası)
}

export interface GradedQuestionFeedback {
  questionId: string;
  orderIndex: number;
  caseContent: string;
  imageUrl: string;
  questionText: string;
  questionType: QuizQuestionType;
  isCorrect: boolean;
  userResponse: string[];
  correctAnswers: string[];
  feedbackText: string;
}

export interface DoctorQuizAttemptLog {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  uid: string;
  doctorName: string;
  residencyYear: number;
  submittedAt: string;
  /** Sunucu kayıtlı başlangıç (ms) ve kullanılan süre (sn) — admin log dashboard'u için */
  startedAtMs?: number;
  submittedAtMs?: number;
  durationSeconds?: number;
  status?: "in_progress" | "submitted";
  lateSubmission?: boolean;
  score: number;
  correctCount: number;
  totalQuestions: number;
  tabSwitchCount: number;
  gradedReport: GradedQuestionFeedback[];
}

/**
 * 6. alandaki "|" ile ayrılmış seçenek metnini 7. alandaki JSON dizisine (optionsArray) dönüştürür.
 */
export function parsePipeSeparatedOptions(optionsRaw: string): string[] {
  if (!optionsRaw || !optionsRaw.trim()) return [];
  return optionsRaw
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Türkçe karakter ve büyük/küçük harf duyarsız yanıt normalizasyonu.
 */
export function normalizeClinicalAnswer(val: string): string {
  return (val || "").trim().toLocaleLowerCase("tr-TR");
}

/**
 * Sınav yanıtlarını değerlendirir ve her sorunun altında doğru/yanlış bağımsız
 * Öğrenme Noktası (Feedback_Text) içeren anlık sonuç karnesini üretir.
 */
export function evaluateClinicalQuizAttempt(
  questions: NineFieldClinicalQuestion[],
  responses: Record<string, string[]>
): {
  score: number;
  correctCount: number;
  totalQuestions: number;
  gradedReport: GradedQuestionFeedback[];
} {
  let correctCount = 0;

  const gradedReport: GradedQuestionFeedback[] = questions.map((q) => {
    const userRes = responses[q.id] || [];
    let isCorrect = false;

    if (q.questionType === "Text Input") {
      const typed = normalizeClinicalAnswer(userRes[0] || "");
      isCorrect =
        typed.length > 0 &&
        typed.length <= (q.maxLength || 250) &&
        q.correctAnswers.some((accepted) => normalizeClinicalAnswer(accepted) === typed);
    } else {
      const normUser = [...userRes].map(normalizeClinicalAnswer).sort();
      const normCorrect = [...q.correctAnswers].map(normalizeClinicalAnswer).sort();
      isCorrect =
        normUser.length === normCorrect.length &&
        normUser.every((val, i) => val === normCorrect[i]);
    }

    if (isCorrect) correctCount++;

    return {
      questionId: q.id,
      orderIndex: q.orderIndex,
      caseContent: q.caseContent,
      imageUrl: q.imageUrl,
      questionText: q.questionText,
      questionType: q.questionType,
      isCorrect,
      userResponse: userRes,
      correctAnswers: q.correctAnswers,
      feedbackText: q.feedbackText,
    };
  });

  const totalQuestions = questions.length || 1;
  const score = Math.round((correctCount / totalQuestions) * 100);

  return { score, correctCount, totalQuestions, gradedReport };
}

/**
 * Tek tıklama ile tüm sınav sonuçlarını veya 9 alanlı soru arşivini CSV/Excel uyumlu tablo olarak indirir.
 */
export function downloadQuizLogsAsCsv(attempts: DoctorQuizAttemptLog[]): void {
  const headers = [
    "AttemptID",
    "SinavAdi",
    "HekimAdi",
    "KidemYili",
    "Tarih",
    "Puan",
    "DogruSayisi",
    "ToplamSoru",
    "SekmeDegistirmeSayisi",
  ];
  const rows = attempts.map((a) => [
    a.attemptId,
    `"${a.quizTitle.replace(/"/g, '""')}"`,
    `"${a.doctorName.replace(/"/g, '""')}"`,
    String(a.residencyYear),
    a.submittedAt,
    String(a.score),
    String(a.correctCount),
    String(a.totalQuestions),
    String(a.tabSwitchCount),
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pediatrist_sinav_sonuclari_log_${Date.now()}.csv`;
  link.click();
}

// ============================================================================
// CSV YÜKLEME (Admin) — Mevcut 9 sütunlu yapıya birebir uygun
// ============================================================================

/** Sunucuya gönderilen 9 alanlı soru (id / orderIndex sunucuda atanır). */
export type QuizQuestionInput = Omit<NineFieldClinicalQuestion, "id" | "orderIndex">;

export const NINE_FIELD_CSV_HEADERS = [
  "Soru İçeriği",
  "Soru Görseli",
  "Sorunun Kendi",
  "Soru Tipi",
  "Maximum Length",
  "Seçenekler",
  "Seçenekler (JSON)",
  "Doğru Seçenek (JSON)",
  "Feedback_Text",
] as const;

export interface CsvRowError {
  row: number; // CSV'deki fiziksel satır (başlık = 1)
  field: string;
  message: string;
}

export interface CsvParseResult {
  questions: QuizQuestionInput[];
  errors: CsvRowError[];
  rowCount: number;
}

const QUESTION_TYPES: QuizQuestionType[] = ["Single Choice", "Multiple Choice", "Text Input"];
const MAX_CSV_BYTES = 2 * 1024 * 1024;

/** RFC 4180 uyumlu CSV ayrıştırıcı: tırnaklı alanlar, kaçışlı "" ve alan içi satır sonları desteklenir. */
export function parseCsvText(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function parseJsonArray(raw: string): string[] | null {
  if (!raw.trim()) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) && v.every((x) => typeof x === "string") ? v.map((x) => x.trim()) : null;
  } catch {
    return null;
  }
}

/**
 * Admin'in yüklediği CSV'yi 9 alanlı soru listesine dönüştürür ve satır bazlı doğrular.
 * Not: Aynı doğrulama Cloud Function (`saveQuizDraft`) içinde sunucuda tekrar yapılır.
 */
export function parseNineFieldQuizCsv(text: string): CsvParseResult {
  const errors: CsvRowError[] = [];
  if (new Blob([text]).size > MAX_CSV_BYTES) {
    return { questions: [], errors: [{ row: 0, field: "Dosya", message: "Dosya 2 MB sınırını aşıyor." }], rowCount: 0 };
  }

  const rows = parseCsvText(text);
  if (rows.length < 2) {
    return { questions: [], errors: [{ row: 0, field: "Dosya", message: "Başlık satırı ve en az 1 soru gerekli." }], rowCount: 0 };
  }

  const header = rows[0].map((h) => h.trim());
  if (header.length < 9) {
    errors.push({ row: 1, field: "Başlık", message: `9 sütun bekleniyordu, ${header.length} bulundu. Şablonu kullanın.` });
    return { questions: [], errors, rowCount: rows.length - 1 };
  }

  const questions: QuizQuestionInput[] = [];
  rows.slice(1).forEach((cells, idx) => {
    const rowNo = idx + 2;
    const c = (i: number) => (cells[i] ?? "").trim();
    const err = (field: string, message: string) => errors.push({ row: rowNo, field, message });
    const before = errors.length;

    const caseContent = c(0);
    const imageUrl = c(1);
    const questionText = c(2);
    const typeRaw = c(3);
    const maxLengthRaw = c(4);
    const optionsRaw = c(5);
    const optionsJson = parseJsonArray(c(6));
    const correct = parseJsonArray(c(7));
    const feedbackText = c(8);

    if (!caseContent) err("1: Soru İçeriği", "Boş olamaz.");
    if (imageUrl && !/^(https:\/\/|quiz_media\/)/.test(imageUrl)) err("2: Soru Görseli", "https:// veya quiz_media/ ile başlamalı.");
    if (!questionText) err("3: Sorunun Kendi", "Boş olamaz.");
    const questionType = QUESTION_TYPES.find((t) => t.toLowerCase() === typeRaw.toLowerCase());
    if (!questionType) err("4: Soru Tipi", `"${typeRaw}" geçersiz. Single Choice | Multiple Choice | Text Input olmalı.`);
    if (optionsJson === null) err("7: Seçenekler (JSON)", 'Geçerli bir JSON dizi olmalı. Örn: ["A","B"]');
    if (correct === null) err("8: Doğru Seçenek", 'Geçerli bir JSON dizi olmalı. Örn: ["A"]');
    else if (correct.length === 0) err("8: Doğru Seçenek", "En az 1 doğru yanıt gerekli.");
    if (!feedbackText) err("9: Feedback_Text", "Öğrenme noktası boş olamaz.");

    const optionsArray = optionsJson && optionsJson.length ? optionsJson : parsePipeSeparatedOptions(optionsRaw);
    let maxLength = 0;

    if (questionType === "Text Input") {
      maxLength = Number(maxLengthRaw);
      if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 2000) err("5: Maximum Length", "Text Input için 1–2000 arası tam sayı olmalı.");
      if (correct && correct.some((a) => a.length > maxLength)) err("8: Doğru Seçenek", "Kabul edilen yanıt Maximum Length'ten uzun.");
    } else if (questionType) {
      if (optionsArray.length < 2) err("6/7: Seçenekler", "Seçenekli sorularda en az 2 seçenek gerekli.");
      const set = new Set(optionsArray.map(normalizeClinicalAnswer));
      if (set.size !== optionsArray.length) err("6/7: Seçenekler", "Tekrarlanan seçenek var.");
      const missing = (correct ?? []).filter((a) => !set.has(normalizeClinicalAnswer(a)));
      if (missing.length) err("8: Doğru Seçenek", `Seçeneklerde bulunmuyor: ${missing.join(", ")}`);
      if (questionType === "Single Choice" && correct && correct.length !== 1) err("8: Doğru Seçenek", "Single Choice tam 1 doğru yanıt içermeli.");
    }

    if (errors.length === before && questionType) {
      questions.push({
        caseContent,
        imageUrl,
        questionText,
        questionType,
        maxLength,
        optionsRaw: optionsArray.join(" | "),
        optionsArray,
        correctAnswers: correct ?? [],
        feedbackText,
      });
    }
  });

  return { questions, errors, rowCount: rows.length - 1 };
}

/** Admin'in indirebileceği örnek CSV şablonu (3 örnek soru: Single / Multiple / Text). */
export function buildNineFieldCsvTemplate(): string {
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [
    [
      "2.5 yaşında erkek; 6 gündür 39.5°C ateş, bilateral konjonktival hiperemi, çilek dili, servikal LAP ve el-ayak ödemi.",
      "",
      "Koroner anevrizmayı önlemek için ilk basamak tedavi nedir?",
      "Single Choice",
      "",
      "Tek doz 2 g/kg IVIG + ASA | Yalnızca metilprednizolon | IV seftriakson | Tek başına ibuprofen",
      "",
      JSON.stringify(["Tek doz 2 g/kg IVIG + ASA"]),
      "Klasik Kawasaki'de ilk 10 gün içinde 2 g/kg IVIG + ASA koroner anevrizma riskini %25'ten %4'ün altına indirir.",
    ],
    [
      "8 aylık; kusma-ishal sonrası letarjik, KDZ 4 sn, taşikardik, turgor ileri derecede azalmış.",
      "",
      "İlk saatte doğru yaklaşımları seçiniz.",
      "Multiple Choice",
      "",
      "",
      JSON.stringify(["20 mL/kg %0.9 NaCl bolus", "90 sn'de damar yolu yoksa IO erişim", "%5 Dekstroz ile yükleme", "Her bolus sonrası yeniden değerlendirme"]),
      JSON.stringify(["20 mL/kg %0.9 NaCl bolus", "90 sn'de damar yolu yoksa IO erişim", "Her bolus sonrası yeniden değerlendirme"]),
      "Hipovolemik şokta izotonik kristalloid 20 mL/kg verilir; hipotonik sıvılar hiponatremi ve beyin ödemine yol açar.",
    ],
    [
      "5 yaşında; havlar tarzda öksürük, ses kısıklığı, inspiratuar stridor. AP boyun grafisinde kalem ucu görünümü.",
      "quiz_media/steeple_sign.png",
      "En olası tanıyı yazınız.",
      "Text Input",
      "40",
      "",
      "",
      JSON.stringify(["Krup", "Viral krup", "Laringotrakeobronşit"]),
      "Steeple sign viral krup için tipiktir; tedavinin temel taşı tek doz 0.15–0.6 mg/kg deksametazondur.",
    ],
  ];
  return "\uFEFF" + [NINE_FIELD_CSV_HEADERS.map(q).join(","), ...rows.map((r) => r.map(q).join(","))].join("\n");
}
