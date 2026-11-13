/**
 * Materyal sınıflaması ve hedef kitlesi: istemci ve sunucunun ORTAK kuralları (CLAUDE.md kural 4).
 *
 * Etiketler (D25, F11.5): sabit kategori listesi yerine admin'in serbestçe yazdığı etiketler. Bir materyalde 0–8
 * etiket, her biri en fazla 40 karakter. Etiket kırpılır, iç boşluklar teke indirilir; aynı materyalde Türkçe
 * küçük harfe göre aynı olanlar tekrar sayılır ("İnfeksiyon" = "infeksiyon"). İlk yazım korunur.
 * Öneri listesi ayrı bir koleksiyonda tutulmaz, mevcut materyallerden türetilir (`distinctLabels`).
 */
import { LIMITS } from "./constants";

/** Kırpar ve iç boşlukları (satır sonu, sekme dahil) tek boşluğa indirir. */
export function normalizeLabel(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Karşılaştırma anahtarı: Türkçe küçük harf (I/ı, İ/i doğru eşlenir). */
export function labelKey(label: string): string {
  return normalizeLabel(label).toLocaleLowerCase("tr");
}

/** Boşları atar, normalize eder ve anahtara göre tekrarları siler (ilk yazım kalır). */
export function normalizeLabels(labels: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const label = normalizeLabel(raw);
    const key = labelKey(label);
    if (!label || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/**
 * Dokümandaki etiketler. F11.5'ten önceki dokümanlarda `labels` yoktur; o zaman eski `category` alanı tek etiket
 * sayılır (veri göçü gerekmeden okunur; materyal düzenlenince `labels` yazılır ve `category` silinir).
 */
export function materialLabelsOf(doc: { labels?: unknown; category?: unknown }): string[] {
  if (Array.isArray(doc.labels)) return normalizeLabels(doc.labels.filter((l): l is string => typeof l === "string"));
  return typeof doc.category === "string" ? normalizeLabels([doc.category]) : [];
}

export interface LabelOption {
  /** `labelKey` */
  key: string;
  /** En sık kullanılan yazım (eşitlikte alfabetik ilk). */
  label: string;
  count: number;
}

/** Materyallerde kullanılan etiketler (öneri ve süzgeç listesi), Türkçe alfabetik. */
export function distinctLabels(materials: readonly { labels: readonly string[] }[]): LabelOption[] {
  const byKey = new Map<string, Map<string, number>>();
  for (const m of materials) {
    for (const label of m.labels) {
      const key = labelKey(label);
      const spellings = byKey.get(key) ?? new Map<string, number>();
      spellings.set(label, (spellings.get(label) ?? 0) + 1);
      byKey.set(key, spellings);
    }
  }
  return [...byKey.entries()]
    .map(([key, spellings]) => {
      const sorted = [...spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"));
      return { key, label: sorted[0][0], count: sorted.reduce((n, [, c]) => n + c, 0) };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "tr"));
}

/** Materyal bu etiketi taşıyor mu? (`"all"` her şeyi geçirir) */
export function hasLabel(material: { labels: readonly string[] }, key: string): boolean {
  return key === "all" || material.labels.some((l) => labelKey(l) === key);
}

export const MATERIAL_LABEL_LIMITS = LIMITS.materialLabels;
