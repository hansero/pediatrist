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
      targetSpecialists: false,
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

describe("materyal hedef kitlesi (D26, F11.6)", () => {
  it("üyenin kitlesi: asistan → yılı; yalnızca Uzm. Dr. → Uzman; Doç./Prof. ve kıdemsiz asistan → yok", async () => {
    const { materialAudienceOf, memberAudienceLabel } = await import("@shared/materials");
    expect(materialAudienceOf({ title: "Asistan Dr.", residencyYear: 3 })).toBe(3);
    expect(materialAudienceOf({ title: "Uzm. Dr.", residencyYear: null })).toBe("specialist");
    expect(materialAudienceOf({ title: "Uzm. Dr.", residencyYear: 2 })).toBe("specialist");
    expect(materialAudienceOf({ title: "Doç. Dr.", residencyYear: null })).toBeNull();
    expect(materialAudienceOf({ title: "Prof. Dr.", residencyYear: null })).toBeNull();
    expect(materialAudienceOf({ title: "Asistan Dr.", residencyYear: null })).toBeNull();
    expect(memberAudienceLabel({ title: "Uzm. Dr.", residencyYear: null })).toBe("Uzman");
    expect(memberAudienceLabel({ title: "Asistan Dr.", residencyYear: 1 })).toBe("1. yıl");
    expect(memberAudienceLabel({ title: "Prof. Dr.", residencyYear: null })).toBe("—");
  });

  it("etiket, eşleşme ve en az bir hedef kuralı; sözleşme 'Uzman' tek başına yeterli", async () => {
    const { audienceLabel, hasAudience, isMaterialTargeted, matchesAudience } = await import("@shared/materials");
    const m = { targetYears: [2, 1], targetSpecialists: true };
    expect(audienceLabel(m)).toBe("1. yıl, 2. yıl, Uzman");
    expect(audienceLabel({ targetYears: [], targetSpecialists: false })).toBe("—");
    expect(matchesAudience(m, "specialist")).toBe(true);
    expect(matchesAudience({ targetYears: [1], targetSpecialists: false }, "specialist")).toBe(false);
    expect(matchesAudience(m, 3)).toBe(false);
    expect(matchesAudience(m, "all")).toBe(true);
    expect(isMaterialTargeted(m, { title: "Doç. Dr.", residencyYear: null })).toBe(false);
    expect(hasAudience([], false)).toBe(false);
    expect(hasAudience([], true)).toBe(true);
    const base = {
      title: "T",
      labels: [],
      isMandatory: false,
      allowDownload: false,
      fileName: "a.pdf",
      contentType: "application/pdf",
      sizeBytes: 10,
    };
    expect(CreateMaterialRequest.safeParse({ ...base, targetYears: [], targetSpecialists: true }).success).toBe(true);
    const none = CreateMaterialRequest.safeParse({ ...base, targetYears: [], targetSpecialists: false });
    expect(none.error?.issues.map((i) => i.message)).toContain("En az bir hedef kıdem seçin.");
  });
});
