/**
 * İstemci tarafı sınav yardımcıları.
 *
 * - CSV ayrıştırma ve soru doğrulama ORTAK modüldedir (`functions/src/shared/quizCsv.ts`,
 *   `quizQuestion.ts`); admin önizlemesi ile sunucu aynı kuralları uygular (F1.2).
 * - Puanlama YALNIZCA sunucuda yapılır (CLAUDE.md kural 5); istemcide puanlama fonksiyonu yoktur.
 */
import type { QuestionType } from "@shared/constants";
import type { NormalizedQuizQuestion } from "@shared/quizQuestion";
import { NINE_FIELD_CSV_HEADERS } from "@shared/quizCsv";
import type { GradedItem } from "@shared/types";
import { downloadCsv, toCsv } from "@/lib/csv";

export {
  NINE_FIELD_CSV_HEADERS,
  parseCsvText,
  parseNineFieldQuizCsv,
  type CsvParseResult,
  type CsvRowError,
} from "@shared/quizCsv";
export { normalizeClinicalAnswer, parsePipeSeparatedOptions } from "@shared/quizQuestion";

export type QuizQuestionType = QuestionType;

/** CSV'den ayrıştırılmış, sunucuya gönderilmeye hazır soru (id / orderIndex sunucuda atanır). */
export type QuizQuestionInput = NormalizedQuizQuestion;

/**
 * Standart 9 Alanlı (A–I) Klinik Vaka Soru Veri Modeli (Firestore Native)
 */
export interface NineFieldClinicalQuestion {
  id: string;
  orderIndex: number;
  caseContent: string; // 1 (A): Soru İçeriği (Klinik Vaka Sunumu ve Hasta Öyküsü)
  imageUrl: string; // 2 (B): Soru Görseli (Firebase Cloud Storage Görsel Yolu / URL)
  questionText: string; // 3 (C): Sorunun Kendi (Vakanın altındaki doğrudan soru cümlesi)
  questionType: QuizQuestionType; // 4 (D): Soru Tipi (Single Choice | Multiple Choice | Text Input)
  maxLength: number; // 5 (E): Maximum Length (Text Input için karakter sınırı)
  optionsRaw: string; // 6 (F): Seçenekler ( | ile ayırın)
  optionsArray: string[]; // 7 (G): Seçenekler (JSON Array - sistem tarafından otomatik dönüştürülür)
  correctAnswers: string[]; // 8 (H): Doğru Seçenek (JSON Array - tekli/çoklu/açık uçlu varyasyonlar)
  feedbackText: string; // 9 (I): Feedback_Text (Doğru/yanlış bağımsız pedagojik Öğrenme Noktası)
}

/** Sunucunun ürettiği karne satırı (ortak tip). */
export type GradedQuestionFeedback = GradedItem;

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

/** Tek tıkla sınav sonuç loglarını CSV olarak indirir. */
export function downloadQuizLogsAsCsv(attempts: DoctorQuizAttemptLog[]): void {
  downloadCsv(
    `pediatrist_sinav_sonuclari_${new Date().toISOString().slice(0, 10)}.csv`,
    [
      "AttemptID",
      "SinavAdi",
      "HekimAdi",
      "KidemYili",
      "Tarih",
      "Puan",
      "DogruSayisi",
      "ToplamSoru",
      "SekmeDegistirmeSayisi",
    ],
    attempts.map((a) => [
      a.attemptId,
      a.quizTitle,
      a.doctorName,
      a.residencyYear,
      a.submittedAt,
      a.score,
      a.correctCount,
      a.totalQuestions,
      a.tabSwitchCount,
    ])
  );
}

/**
 * Admin'in indirebileceği 9 sütunlu boş şablon + 3 örnek satır (doldurma kılavuzu).
 * Örnek satırlar yalnızca biçimi gösterir; şablon gerçek ayrıştırıcıdan hatasız geçer (birim testi).
 */
export function buildNineFieldCsvTemplate(): string {
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
      JSON.stringify([
        "20 mL/kg %0.9 NaCl bolus",
        "90 sn'de damar yolu yoksa IO erişim",
        "%5 Dekstroz ile yükleme",
        "Her bolus sonrası yeniden değerlendirme",
      ]),
      JSON.stringify([
        "20 mL/kg %0.9 NaCl bolus",
        "90 sn'de damar yolu yoksa IO erişim",
        "Her bolus sonrası yeniden değerlendirme",
      ]),
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
  return toCsv(NINE_FIELD_CSV_HEADERS, rows);
}
