import { describe, expect, it } from "vitest";
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
