/**
 * Materyal sınıflaması ve hedef kitlesi: istemci ve sunucunun ORTAK kuralları (CLAUDE.md kural 4).
 *
 * Etiketler (D25, F11.5): sabit kategori listesi yerine admin'in serbestçe yazdığı etiketler. Bir materyalde 0–8
 * etiket, her biri en fazla 40 karakter. Etiket kırpılır, iç boşluklar teke indirilir; aynı materyalde Türkçe
 * küçük harfe göre aynı olanlar tekrar sayılır ("İnfeksiyon" = "infeksiyon"). İlk yazım korunur.
 * Öneri listesi ayrı bir koleksiyonda tutulmaz, mevcut materyallerden türetilir (`distinctLabels`).
 *
 * Hedef kitle (D26, F11.6): kıdem yılları (`targetYears`, 1–4) ve "Uzman" (`targetSpecialists`). En az biri
 * seçilir. "Uzman" yalnızca ünvanı `Uzm. Dr.` olan üyedir; Doç./Prof. hiçbir hedef kitleye girmez (varsayılan
 * süzgeçleri "Bütün kıdemler"). Görünürlük kısıtı değildir: hedef kitle süzgeç, zorunlu materyal ve okunma
 * raporu içindir; yayındaki her materyal etkin üyeye açıktır.
 */
import { isResidentTitle, LIMITS, RESIDENCY_YEARS } from "./constants";

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

// --- Hedef kitle (D26) ---------------------------------------------------------------------------

/** "Uzman" hedef kitlesindeki ünvan (kullanıcı kararı: yalnızca Uzm. Dr.; Doç./Prof. dahil değil). */
export const SPECIALIST_TITLE = "Uzm. Dr.";

/** Bir üyenin materyal hedef kitlesindeki yeri: kıdem yılı, "Uzman" ya da hiçbiri (`null`: Doç./Prof., admin). */
export type MaterialAudience = number | "specialist";

export interface MaterialTarget {
  targetYears: readonly number[];
  targetSpecialists: boolean;
}

export function materialAudienceOf(member: { title: string; residencyYear: number | null }): MaterialAudience | null {
  if (isResidentTitle(member.title)) {
    return (RESIDENCY_YEARS as readonly number[]).includes(member.residencyYear ?? 0) ? member.residencyYear : null;
  }
  return member.title === SPECIALIST_TITLE ? "specialist" : null;
}

/** Materyal bu kitleye yönelik mi? (`"all"` her şeyi geçirir; süzgeç için) */
export function matchesAudience(material: MaterialTarget, audience: MaterialAudience | "all"): boolean {
  if (audience === "all") return true;
  return audience === "specialist" ? material.targetSpecialists : material.targetYears.includes(audience);
}

/** Üye bu materyalin hedef kitlesinde mi? (Doç./Prof. ve admin hiçbir hedef kitlede değildir.) */
export function isMaterialTargeted(material: MaterialTarget, member: { title: string; residencyYear: number | null }) {
  const audience = materialAudienceOf(member);
  return audience !== null && matchesAudience(material, audience);
}

/** En az bir hedef seçili mi? (sunucu ve form aynı kural) */
export const hasAudience = (targetYears: readonly unknown[], targetSpecialists: boolean): boolean =>
  targetYears.length > 0 || targetSpecialists;

export const AUDIENCE_REQUIRED_MESSAGE = "En az bir hedef kıdem seçin.";

/** "1. yıl, 2. yıl, Uzman" */
export function audienceLabel(material: MaterialTarget): string {
  const parts = [...material.targetYears].sort((a, b) => a - b).map((y) => `${y}. yıl`);
  if (material.targetSpecialists) parts.push("Uzman");
  return parts.length ? parts.join(", ") : "—";
}

/** Üyenin kıdem/kitle etiketi (rapor sütunu): "3. yıl", "Uzman" ya da "—". */
export function memberAudienceLabel(member: { title: string; residencyYear: number | null }): string {
  const audience = materialAudienceOf(member);
  return audience === null ? "—" : audience === "specialist" ? "Uzman" : `${audience}. yıl`;
}
