import { describe, expect, it } from "vitest";
import { parseCsvText } from "@shared/quizCsv";
import { buildNineFieldCsvTemplate, parseNineFieldQuizCsv } from "@/lib/quiz-parser";
import { escapeCsvCell, toCsv } from "@/lib/csv";

describe("escapeCsvCell", () => {
  it("formül enjeksiyonuna karşı =, +, -, @ ile başlayan hücreleri etkisizleştirir", () => {
    expect(escapeCsvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(escapeCsvCell("+1")).toBe("'+1");
    expect(escapeCsvCell("-5")).toBe("'-5");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });
  it("ayırıcı, tırnak veya satır sonu içeren hücreyi tırnaklar", () => {
    expect(escapeCsvCell("a;b")).toBe('"a;b"');
    expect(escapeCsvCell('dedi ki "x"')).toBe('"dedi ki ""x"""');
    expect(escapeCsvCell("iki\nsatır")).toBe('"iki\nsatır"');
    expect(escapeCsvCell("virgül, sorun değil")).toBe("virgül, sorun değil");
  });
  it("null/undefined boş hücre, sayı metin olur", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell(42)).toBe("42");
  });
});

describe("toCsv", () => {
  it("BOM ve ';' ayırıcı ile yazar; ayrıştırıcı aynı hücreleri geri okur", () => {
    const rows = [
      ["Asistan Dr. Ayşe", "Çocuk Acil & Yoğun Bakım", "Kawasaki; IVIG", 'Not: "acil"'],
      ["İkinci", "2 satır\nmetin", "", "%70"],
    ];
    const csv = toCsv(["Ad", "Kategori", "Konu", "Not"], rows);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.split("\r\n")[0]).toBe("﻿Ad;Kategori;Konu;Not");
    expect(parseCsvText(csv)).toEqual([["Ad", "Kategori", "Konu", "Not"], ...rows]);
  });
});

describe("sınav şablonu", () => {
  it("indirilen şablon ';' ile yazılır ve ayrıştırıcıdan hatasız geçer", () => {
    const tpl = buildNineFieldCsvTemplate();
    expect(tpl.split("\r\n")[0]).toContain(";");
    const res = parseNineFieldQuizCsv(tpl);
    expect(res.errors).toEqual([]);
    expect(res.questions).toHaveLength(3);
  });
});

describe("9 sütunlu dışa aktarım (F5.2 arşiv)", () => {
  it("dışa aktarılan sorular aynen yeniden içe aktarılır (ek sütunlar yok sayılır)", async () => {
    const { toNineFieldCsvRows, NINE_FIELD_CSV_HEADERS } = await import("@/lib/quiz-parser");
    const { toCsv } = await import("@/lib/csv");
    const original = parseNineFieldQuizCsv(buildNineFieldCsvTemplate()).questions;
    expect(original).toHaveLength(3);
    const rows = toNineFieldCsvRows(original).map((r) => [...r, "Kaynak sınav; 1", "2026-11-11"]);
    const text = toCsv([...NINE_FIELD_CSV_HEADERS, "Kaynak sınav", "Arşivlenme"], rows);
    const again = parseNineFieldQuizCsv(text);
    expect(again.errors).toEqual([]);
    expect(again.questions).toEqual(original);
  });
});
