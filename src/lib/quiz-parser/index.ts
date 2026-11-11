/**
 * İstemci tarafı sınav yardımcıları.
 *
 * - CSV ayrıştırma ve soru doğrulama ORTAK modüldedir (`functions/src/shared/quizCsv.ts`,
 *   `quizQuestion.ts`); admin önizlemesi ile sunucu aynı kuralları uygular (F1.2).
 * - Puanlama YALNIZCA sunucuda yapılır (CLAUDE.md kural 5); istemcide puanlama fonksiyonu yoktur.
 */
import type { QuestionType } from "@shared/constants";
import { NINE_FIELD_CSV_HEADERS } from "@shared/quizCsv";
import { toCsv } from "@/lib/csv";

export {
  NINE_FIELD_CSV_HEADERS,
  parseCsvText,
  parseNineFieldQuizCsv,
  type CsvParseResult,
  type CsvRowError,
} from "@shared/quizCsv";
export { normalizeClinicalAnswer, parsePipeSeparatedOptions } from "@shared/quizQuestion";

/** 9 alanlı soru (arşivden veya önizlemeden). */
export interface NineFieldQuestionLike {
  caseContent: string;
  imageUrl: string;
  questionText: string;
  questionType: QuestionType;
  maxLength: number;
  optionsArray: string[];
  correctAnswers: string[];
  feedbackText: string;
}

/**
 * Soruları 9 sütunlu İÇE AKTARILABİLİR CSV satırlarına çevirir (F5.2 arşiv dışa aktarımı). Seçenekler JSON
 * sütunundan yazılır (6. sütun boş). `extra` sütunlar 9 sütundan SONRA eklenir; ayrıştırıcı yalnızca ilk 9
 * sütunu okuduğu için dosya aynen yeniden yüklenebilir.
 */
export function toNineFieldCsvRows(questions: readonly NineFieldQuestionLike[]): string[][] {
  return questions.map((q) => [
    q.caseContent,
    q.imageUrl,
    q.questionText,
    q.questionType,
    q.questionType === "Text Input" ? String(q.maxLength) : "",
    "",
    q.questionType === "Text Input" ? "" : JSON.stringify(q.optionsArray),
    JSON.stringify(q.correctAnswers),
    q.feedbackText,
  ]);
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
