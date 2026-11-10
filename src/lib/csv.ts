/**
 * CSV dışa aktarımı: uygulamanın TEK CSV yazıcısı (F1.2).
 *
 * - Ayırıcı `;`: Türkçe yerel ayarlı Excel virgülü ondalık ayırıcı olarak kullandığından `,` ile
 *   ayrılmış dosyaları tek sütunda açar. (İçe aktarım her iki ayırıcıyı da tanır.)
 * - UTF-8 BOM: Excel'in Türkçe karakterleri doğru göstermesi için.
 * - Formül enjeksiyonu koruması (OWASP): `=`, `+`, `-`, `@`, sekme veya CR ile başlayan hücrelerin
 *   başına `'` eklenir. Not: Bu hücreler yeniden içe aktarılırsa `'` metnin parçası olur.
 */

export type CsvCell = string | number | boolean | null | undefined;

export const CSV_DELIMITER = ";";

export function escapeCsvCell(value: CsvCell, delimiter: string = CSV_DELIMITER): string {
  const s = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  const needsQuotes = safe.includes('"') || safe.includes(delimiter) || /[\n\r]/.test(safe);
  return needsQuotes ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Başlık + satırlardan CSV metni üretir (BOM dahil). Saf fonksiyon; test edilebilir. */
export function toCsv(headers: readonly string[], rows: ReadonlyArray<ReadonlyArray<CsvCell>>): string {
  const lines = [headers, ...rows].map((r) => r.map((c) => escapeCsvCell(c)).join(CSV_DELIMITER));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** Tarayıcıda metni dosya olarak indirir. */
export function downloadTextFile(fileName: string, text: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Bazı tarayıcılar (Firefox) indirme başlamadan URL iptal edilirse dosyayı kaydetmez.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(fileName: string, headers: readonly string[], rows: ReadonlyArray<ReadonlyArray<CsvCell>>) {
  downloadTextFile(fileName, toCsv(headers, rows), "text/csv;charset=utf-8");
}
