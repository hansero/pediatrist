import { describe, expect, it } from "vitest";
import { SaveQuizDraftRequest } from "@shared";
import {
  buildNineFieldCsvTemplate,
  normalizeClinicalAnswer,
  parseCsvText,
  parseNineFieldQuizCsv,
} from "@/lib/quiz-parser";

/**
 * Gerçek modülü test eder (mantık kopyalanmaz). F1.2'de doğrulayıcı
 * `functions/src/shared/quizCsv.ts`'e taşındığında import yolu güncellenir.
 */

const csvRow = (cells: string[]) => cells.map((v) => `"${v.replace(/"/g, '""')}"`).join(",");

const HEADER =
  "Soru İçeriği,Soru Görseli,Sorunun Kendi,Soru Tipi,Maximum Length,Seçenekler,Seçenekler (JSON),Doğru Seçenek (JSON),Feedback_Text";

describe("parseCsvText", () => {
  it("tırnaklı alanları, kaçışlı çift tırnağı ve alan içi satır sonunu korur", () => {
    const rows = parseCsvText('a,"b ""x"", y","çok\nsatırlı"\r\n1,2,3');
    expect(rows).toEqual([
      ["a", 'b "x", y', "çok\nsatırlı"],
      ["1", "2", "3"],
    ]);
  });

  it("başlıkta noktalı virgül baskınsa ayırıcı olarak ';' kullanır (Türkçe Excel)", () => {
    expect(parseCsvText("a;b;c\n1;2,5;3")).toEqual([
      ["a", "b", "c"],
      ["1", "2,5", "3"],
    ]);
  });

  it("BOM'u ve tamamen boş satırları atar", () => {
    expect(parseCsvText("﻿a,b\n,\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("normalizeClinicalAnswer", () => {
  it("Türkçe büyük/küçük harf duyarsız karşılaştırma için normalize eder", () => {
    expect(normalizeClinicalAnswer("  İNTRAOSSEÖZ  ")).toBe("intraosseöz");
    expect(normalizeClinicalAnswer("KRUP")).toBe(normalizeClinicalAnswer("krup"));
  });
});

describe("parseNineFieldQuizCsv", () => {
  it("örnek şablondaki 3 soruyu hatasız ayrıştırır", () => {
    const res = parseNineFieldQuizCsv(buildNineFieldCsvTemplate());
    expect(res.errors).toEqual([]);
    expect(res.questions.map((q) => q.questionType)).toEqual(["Single Choice", "Multiple Choice", "Text Input"]);
  });

  it("doğru seçenek seçenekler arasında yoksa satır numarasıyla hata verir", () => {
    const row = csvRow(["Vaka", "", "Soru?", "Single Choice", "", "A | B", "", '["C"]', "Öğrenme noktası"]);
    const res = parseNineFieldQuizCsv(`${HEADER}\n${row}`);
    expect(res.questions).toHaveLength(0);
    expect(res.errors).toContainEqual(expect.objectContaining({ row: 2, field: "8: Doğru Seçenek" }));
  });

  it("Text Input için Maximum Length zorunludur", () => {
    const row = csvRow(["Vaka", "", "Tanı?", "Text Input", "", "", "", '["Krup"]', "Öğrenme noktası"]);
    const res = parseNineFieldQuizCsv(`${HEADER}\n${row}`);
    expect(res.errors).toContainEqual(expect.objectContaining({ row: 2, field: "5: Maximum Length" }));
  });

  it("9'dan az sütunlu başlığı reddeder", () => {
    const res = parseNineFieldQuizCsv("a,b,c\n1,2,3");
    expect(res.questions).toHaveLength(0);
    expect(res.errors[0]).toMatchObject({ row: 1, field: "Başlık" });
  });
});

describe("ortak doğrulayıcı (F1.2): istemci önizlemesi = sunucu sözleşmesi", () => {
  const valid: Record<string, string | string[]> = {
    caseContent: "Vaka",
    imageUrl: "",
    questionText: "Soru?",
    questionType: "Single Choice",
    maxLength: "",
    optionsRaw: "A | B | C",
    optionsArray: [],
    correctAnswers: ["B"],
    feedbackText: "Öğrenme noktası",
  };
  const toRow = (q: Record<string, string | string[]>) =>
    csvRow([
      q.caseContent as string,
      q.imageUrl as string,
      q.questionText as string,
      q.questionType as string,
      q.maxLength as string,
      q.optionsRaw as string,
      (q.optionsArray as string[]).length ? JSON.stringify(q.optionsArray) : "",
      JSON.stringify(q.correctAnswers),
      q.feedbackText as string,
    ]);
  const toDraft = (q: Record<string, string | string[]>) => ({
    ...q,
    maxLength: q.maxLength === "" ? undefined : Number(q.maxLength),
  });

  const variants: Array<[string, Record<string, string | string[]>]> = [
    ["geçerli tek seçmeli", valid],
    ["geçerli çoklu seçmeli", { ...valid, questionType: "Multiple Choice", correctAnswers: ["A", "C"] }],
    [
      "geçerli açık uçlu",
      { ...valid, questionType: "Text Input", maxLength: "40", optionsRaw: "", correctAnswers: ["Krup"] },
    ],
    ["geçerli görselli", { ...valid, imageUrl: "quiz_media/x.png" }],
    ["tek seçmelide 2 doğru", { ...valid, correctAnswers: ["A", "B"] }],
    ["doğru cevap seçeneklerde yok", { ...valid, correctAnswers: ["Z"] }],
    ["tekrarlı seçenek", { ...valid, optionsRaw: "A | a | B" }],
    ["tek seçenek", { ...valid, optionsRaw: "A", correctAnswers: ["A"] }],
    ["açık uçluda maxLength yok", { ...valid, questionType: "Text Input", optionsRaw: "" }],
    ["açık uçluda maxLength 2001", { ...valid, questionType: "Text Input", maxLength: "2001", optionsRaw: "" }],
    [
      "yanıt maxLength'ten uzun",
      { ...valid, questionType: "Text Input", maxLength: "3", optionsRaw: "", correctAnswers: ["Krup"] },
    ],
    ["harici görsel URL'si", { ...valid, imageUrl: "https://example.com/x.png" }],
    ["boş vaka", { ...valid, caseContent: "" }],
    ["boş feedback", { ...valid, feedbackText: "" }],
    ["geçersiz soru tipi", { ...valid, questionType: "Essay" }],
  ];

  it.each(variants)("%s: iki taraf aynı kararı verir", (_name, q) => {
    const client = parseNineFieldQuizCsv(`${HEADER}\n${toRow(q)}`);
    const server = SaveQuizDraftRequest.safeParse({ title: "S", durationMinutes: 10, questions: [toDraft(q)] });
    expect(client.errors.length === 0).toBe(server.success);
    expect(client.questions.length === 1).toBe(server.success);
  });

  it("geçersiz varyantların hepsi gerçekten reddedilir (testin boşa geçmediğinin kontrolü)", () => {
    const rejected = variants.filter(([, q]) => parseNineFieldQuizCsv(`${HEADER}\n${toRow(q)}`).errors.length > 0);
    expect(rejected.map(([n]) => n)).toEqual(variants.slice(4).map(([n]) => n));
  });

  it("seçenekleri normalize eder: '|' metni listeye, açık uçluda liste boşalır", () => {
    const [choice] = parseNineFieldQuizCsv(`${HEADER}\n${toRow(valid)}`).questions;
    expect(choice.optionsArray).toEqual(["A", "B", "C"]);
    expect(choice.optionsRaw).toBe("A | B | C");
    expect(choice.maxLength).toBe(0);
    const text = {
      ...valid,
      questionType: "Text Input",
      maxLength: "40",
      optionsRaw: "A | B",
      correctAnswers: ["Krup"],
    };
    const [q] = parseNineFieldQuizCsv(`${HEADER}\n${toRow(text)}`).questions;
    expect(q.optionsArray).toEqual([]);
    expect(q.maxLength).toBe(40);
  });

  it("hata satırını ve sütun etiketini verir", () => {
    const res = parseNineFieldQuizCsv(`${HEADER}\n${toRow(valid)}\n${toRow({ ...valid, optionsRaw: "A | a | B" })}`);
    expect(res.questions).toHaveLength(1);
    expect(res.errors).toEqual([{ row: 3, field: "6/7: Seçenekler", message: "Tekrarlanan seçenek var." }]);
  });
});

describe("başlık adı doğrulaması", () => {
  it("sütunlar yer değiştirmişse reddeder (eskiden sessizce yanlış alana eşleniyordu)", () => {
    const swapped = HEADER.split(",");
    [swapped[0], swapped[2]] = [swapped[2], swapped[0]];
    const res = parseNineFieldQuizCsv(`${swapped.join(",")}\n${csvRow(Array(9).fill("x"))}`);
    expect(res.questions).toHaveLength(0);
    expect(res.errors.map((e) => e.message)).toEqual([
      '1. sütun "Soru İçeriği" olmalı, "Sorunun Kendi" bulundu.',
      '3. sütun "Sorunun Kendi" olmalı, "Soru İçeriği" bulundu.',
    ]);
  });
  it("büyük/küçük harf ve boşluk farkını önemsemez", () => {
    const loose = HEADER.split(",")
      .map((h) => `  ${h.toLocaleUpperCase("tr-TR")} `)
      .join(",");
    expect(
      parseNineFieldQuizCsv(`${loose}\n${csvRow(["V", "", "S?", "Single Choice", "", "A | B", "", '["A"]', "F"])}`)
        .errors
    ).toEqual([]);
  });
});
