/**
 * 9 sütunlu sınav CSV'si: ayrıştırma + doğrulama (F1.2).
 *
 * Her satır, sunucunun da kullandığı `QuizQuestionInput` şemasından geçer (`quizQuestion.ts`).
 * Bu dosya yalnızca CSV'ye özgü işleri yapar: RFC 4180 ayrıştırma, ayırıcı tespiti, başlık adı
 * doğrulaması, JSON dizi sütunlarının okunması ve hataların satır/sütun etiketine çevrilmesi.
 */
import { QUESTION_TYPES } from "./constants";
import { QUESTION_FIELD_LABELS, QuizQuestionInput, type NormalizedQuizQuestion } from "./quizQuestion";

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

export const MAX_CSV_BYTES = 2 * 1024 * 1024;

export interface CsvRowError {
  /** CSV'deki fiziksel satır (başlık = 1). Dosya düzeyindeki hatalarda 0. */
  row: number;
  field: string;
  message: string;
}

export interface CsvParseResult {
  questions: NormalizedQuizQuestion[];
  errors: CsvRowError[];
  rowCount: number;
}

/** RFC 4180 uyumlu ayrıştırıcı: tırnaklı alanlar, kaçışlı "" ve alan içi satır sonları desteklenir. */
export function parseCsvText(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
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

/** JSON string dizisi; boş hücre → []; geçersiz → null. */
function parseJsonArray(raw: string): string[] | null {
  if (!raw.trim()) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) && v.every((x) => typeof x === "string") ? v.map((x) => x.trim()) : null;
  } catch {
    return null;
  }
}

const normHeader = (h: string) => h.trim().toLocaleLowerCase("tr-TR");

/**
 * Admin'in yüklediği CSV'yi normalize edilmiş soru listesine dönüştürür ve satır bazlı doğrular.
 * Bir satırda hata varsa o satır `questions`'a eklenmez.
 */
export function parseNineFieldQuizCsv(text: string): CsvParseResult {
  if (new TextEncoder().encode(text).byteLength > MAX_CSV_BYTES) {
    return { questions: [], errors: [{ row: 0, field: "Dosya", message: "Dosya 2 MB sınırını aşıyor." }], rowCount: 0 };
  }

  const rows = parseCsvText(text);
  if (rows.length < 2) {
    return {
      questions: [],
      errors: [{ row: 0, field: "Dosya", message: "Başlık satırı ve en az 1 soru gerekli." }],
      rowCount: 0,
    };
  }

  const header = rows[0].map((h) => h.trim());
  if (header.length < NINE_FIELD_CSV_HEADERS.length) {
    return {
      questions: [],
      errors: [
        {
          row: 1,
          field: "Başlık",
          message: `${NINE_FIELD_CSV_HEADERS.length} sütun bekleniyordu, ${header.length} bulundu. Şablonu kullanın.`,
        },
      ],
      rowCount: rows.length - 1,
    };
  }
  const headerErrors: CsvRowError[] = NINE_FIELD_CSV_HEADERS.flatMap((expected, i) =>
    normHeader(header[i]) === normHeader(expected)
      ? []
      : [{ row: 1, field: "Başlık", message: `${i + 1}. sütun "${expected}" olmalı, "${header[i]}" bulundu.` }]
  );
  if (headerErrors.length) return { questions: [], errors: headerErrors, rowCount: rows.length - 1 };

  const errors: CsvRowError[] = [];
  const questions: NormalizedQuizQuestion[] = [];

  rows.slice(1).forEach((cells, idx) => {
    const rowNo = idx + 2;
    const c = (i: number) => (cells[i] ?? "").trim();
    const rowErrors: CsvRowError[] = [];

    const optionsJson = parseJsonArray(c(6));
    const correct = parseJsonArray(c(7));
    if (optionsJson === null) {
      rowErrors.push({
        row: rowNo,
        field: "7: Seçenekler (JSON)",
        message: 'Geçerli bir JSON dizi olmalı. Örn: ["A","B"]',
      });
    }
    if (correct === null) {
      rowErrors.push({ row: rowNo, field: "8: Doğru Seçenek", message: 'Geçerli bir JSON dizi olmalı. Örn: ["A"]' });
    }
    if (rowErrors.length) {
      errors.push(...rowErrors);
      return;
    }

    const typeRaw = c(3);
    const maxLengthRaw = c(4);
    const result = QuizQuestionInput.safeParse({
      caseContent: c(0),
      imageUrl: c(1),
      questionText: c(2),
      questionType: QUESTION_TYPES.find((t) => t.toLowerCase() === typeRaw.toLowerCase()) ?? typeRaw,
      maxLength: maxLengthRaw === "" ? undefined : Number(maxLengthRaw),
      optionsRaw: c(5),
      optionsArray: optionsJson ?? [],
      correctAnswers: correct ?? [],
      feedbackText: c(8),
    });

    if (result.success) {
      questions.push(result.data);
      return;
    }
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "");
      errors.push({ row: rowNo, field: QUESTION_FIELD_LABELS[key] ?? (key || "Satır"), message: issue.message });
    }
  });

  return { questions, errors, rowCount: rows.length - 1 };
}
