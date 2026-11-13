import { describe, expect, it } from "vitest";
import { distinctLabels, hasLabel, labelKey, materialLabelsOf, normalizeLabels } from "@shared/materials";
import { CreateMaterialRequest } from "@shared/schemas";

describe("materyal etiketleri (D25, F11.5)", () => {
  it("normalize: kırpılır, iç boşluklar teke iner, Türkçe küçük harfe göre tekrarsız, ilk yazım kalır", () => {
    expect(
      normalizeLabels(["  Çocuk   Acil ", "çocuk acil", "", "  ", "İnfeksiyon", "infeksiyon", "ınfeksiyon"])
    ).toEqual(["Çocuk Acil", "İnfeksiyon", "ınfeksiyon"]);
    expect(labelKey("İNFEKSİYON")).toBe("infeksiyon");
    expect(labelKey("IŞIK")).toBe("ışık");
  });

  it("eski dokümanda kategori tek etiket sayılır; etiketler varsa kategori yok sayılır", () => {
    expect(materialLabelsOf({ category: "Neonatoloji (Yenidoğan)" })).toEqual(["Neonatoloji (Yenidoğan)"]);
    expect(materialLabelsOf({ labels: ["Acil"], category: "Eski" })).toEqual(["Acil"]);
    expect(materialLabelsOf({ labels: [], category: "Eski" })).toEqual([]);
    expect(materialLabelsOf({})).toEqual([]);
    expect(materialLabelsOf({ labels: ["A", 3, null, "a"] })).toEqual(["A"]);
  });

  it("öneri/süzgeç listesi: anahtar başına bir seçenek, en sık yazım, alfabetik; etiket eşleşmesi anahtarla", () => {
    const list = [
      { labels: ["Neonatoloji", "Acil"] },
      { labels: ["neonatoloji"] },
      { labels: ["Neonatoloji", "Çocuk"] },
    ];
    expect(distinctLabels(list)).toEqual([
      { key: "acil", label: "Acil", count: 1 },
      { key: "çocuk", label: "Çocuk", count: 1 },
      { key: "neonatoloji", label: "Neonatoloji", count: 3 },
    ]);
    expect(hasLabel({ labels: ["NEONATOLOJİ"] }, "neonatoloji")).toBe(true);
    expect(hasLabel({ labels: [] }, "all")).toBe(true);
    expect(hasLabel({ labels: ["Acil"] }, "neonatoloji")).toBe(false);
  });

  it("sözleşme: en çok 8 etiket, her biri 1–40 karakter; tekrarlar sunucuya tek gider", () => {
    const base = {
      title: "T",
      targetYears: [1],
      isMandatory: false,
      allowDownload: false,
      fileName: "a.pdf",
      contentType: "application/pdf",
      sizeBytes: 10,
    };
    expect(CreateMaterialRequest.parse({ ...base, labels: [" Acil ", "acil", "Neo"] }).labels).toEqual(["Acil", "Neo"]);
    expect(CreateMaterialRequest.parse({ ...base, labels: [] }).labels).toEqual([]);
    const errorsOf = (labels: unknown) =>
      CreateMaterialRequest.safeParse({ ...base, labels }).error?.issues.map((i) => i.message) ?? [];
    expect(errorsOf(Array.from({ length: 9 }, (_, i) => `E${i}`))).toContain(
      "Bir materyale en fazla 8 etiket verilebilir."
    );
    expect(errorsOf(["x".repeat(41)])).toContain("Etiket en fazla 40 karakter olabilir.");
    expect(errorsOf(["   "])).toContain("Etiket boş olamaz.");
    expect(errorsOf(undefined).length).toBeGreaterThan(0);
  });
});
