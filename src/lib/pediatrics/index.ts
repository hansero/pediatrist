export type PediatricCalculatorCategory =
  "fluid_electrolyte" | "anthropometry_renal" | "emergency_pals" | "neonatology" | "clinical_scores";

export interface PediatricCalculatorPlaceholderConfig {
  id: string;
  code: string;
  title: string;
  category: PediatricCalculatorCategory;
  categoryLabel: string;
  summary: string;
  plannedInputs: string[];
  plannedOutputs: string[];
  clinicalProtocolNote: string;
  maxDoseGuardrailNote: string;
  formulaVersion: string;
  isActive: boolean;
  status: "placeholder_ready";
}

/**
 * Faz 2: Pediatri Hesaplama Uygulamaları Yer Tutucu (Placeholder) Yapılandırması.
 * Detaylı tıbbi formül motoru daha sonraki aşamada bu şema üzerine kodlanacaktır.
 */
export const PEDIATRIC_CALCULATORS_CATALOG: PediatricCalculatorPlaceholderConfig[] = [
  {
    id: "calc_holliday_segar",
    code: "FLUID-01",
    title: "Holliday-Segar İdame ve Defisit Sıvı Hesaplayıcı",
    category: "fluid_electrolyte",
    categoryLabel: "Sıvı & Elektrolit Yönetimi",
    summary:
      "Kilo ve dehidratasyon yüzdesine göre 24 saatlik idame sıvı, saatlik infüzyon hızı ve defisit replasman planı.",
    plannedInputs: ["Vücut Ağırlığı (kg)", "Dehidratasyon Derecesi (%3, %5, %10)", "Serum Sodyum (mEq/L)"],
    plannedOutputs: [
      "Günlük İdame (mL/24s)",
      "Saatlik İnfüzyon Hızı (mL/saat)",
      "Defisit + İdame 1. ve 2. 8 Saatlik Plan",
    ],
    clinicalProtocolNote:
      "Kliniğimizde izotonik (%0.9 NaCl + %5 Dekstroz) standart idame sıvısı olarak tercih edilmektedir.",
    maxDoseGuardrailNote: "Günlük toplam idame sıvı üst sınırı 2400 mL/24 saat olarak sınırlandırılmıştır.",
    formulaVersion: "v1.0-placeholder",
    isActive: true,
    status: "placeholder_ready",
  },
  {
    id: "calc_bsa_schwartz",
    code: "RENAL-02",
    title: "Vücut Yüzey Alanı (Mosteller BSA) & Bedside Schwartz eGFR",
    category: "anthropometry_renal",
    categoryLabel: "Antropometri & Böbrek Fonksiyonu",
    summary:
      "Kemoterapi/ilaç dozlaması için Mosteller BSA (m²) ve boy/serum kreatinin bazlı pediatrik eGFR (mL/dk/1.73m²).",
    plannedInputs: ["Boy (cm)", "Vücut Ağırlığı (kg)", "Serum Kreatinin (mg/dL)"],
    plannedOutputs: ["Mosteller BSA (m²)", "Bedside Schwartz eGFR (mL/dk/1.73m²)", "KDIGO Evre Göstergesi"],
    clinicalProtocolNote: "Kreatinin enzimatik (IDMS) yönteme göre k = 0.413 sabiti kullanılacaktır.",
    maxDoseGuardrailNote: "eGFR < 60 mL/dk/1.73m² durumunda nefrotoksik antibiyotik doz uyarısı tetiklenir.",
    formulaVersion: "v1.0-placeholder",
    isActive: true,
    status: "placeholder_ready",
  },
  {
    id: "calc_pals_emergency",
    code: "PALS-03",
    title: "Pediatrik Acil / PALS Resüsitasyon Dozları ve Broselow Bandı",
    category: "emergency_pals",
    categoryLabel: "Çocuk Acil & Resüsitasyon",
    summary:
      "Kilo bazlı Adrenalin, Adenozin, Amiodaron, Midazolam dozları, endotrakeal tüp çapı/derinliği ve defibrilasyon (Joule) hesabı.",
    plannedInputs: ["Vücut Ağırlığı (kg)", "Yaş (Ay / Yıl)", "Klinik Senaryo (KPR / SVT / Status Epileptikus)"],
    plannedOutputs: [
      "Adrenalin IV/IO (0.01 mg/kg)",
      "Kaflı/Kafsız ETT Çapı (mm) ve Dudak Kenarı Derinliği (cm)",
      "Defibrilasyon 2–4 J/kg",
    ],
    clinicalProtocolNote: "Status epileptikus 1. basamakta bukkal/IM Midazolam protokolü uygulanır.",
    maxDoseGuardrailNote: "Tek doz IV Adrenalin maksimum 1 mg (10 mL 1:10.000) tavan sınırı aktiftir.",
    formulaVersion: "v1.0-placeholder",
    isActive: true,
    status: "placeholder_ready",
  },
  {
    id: "calc_neonatal_bilirubin",
    code: "NEO-04",
    title: "Yenidoğan Düzeltilmiş Yaş & Fototerapi / Kan Değişimi (Bilirubin) Eşikleri",
    category: "neonatology",
    categoryLabel: "Neonatoloji (Yenidoğan)",
    summary:
      "Gebelik haftası, postnatal saatlik yaş ve nörotoksisite risk faktörlerine göre AAP fototerapi ve kan değişimi eğrileri.",
    plannedInputs: [
      "Gebelik Haftası (GH)",
      "Postnatal Yaş (Saat)",
      "Total Serum Bilirubin (mg/dL)",
      "Nörotoksisite Risk Faktörü",
    ],
    plannedOutputs: ["Fototerapi Eşiği (mg/dL)", "Kan Değişimi Eşiği (mg/dL)", "Prematüre Düzeltilmiş Yaş (Hafta/Ay)"],
    clinicalProtocolNote: "AAP 2022 hiperbilirubinemi kılavuzu eğrileri baz alınacaktır.",
    maxDoseGuardrailNote: "Postnatal < 24 saat sarılıklarında otomatik patolojik sarılık uyarısı gösterilir.",
    formulaVersion: "v1.0-placeholder",
    isActive: true,
    status: "placeholder_ready",
  },
  {
    id: "calc_growth_clinical_scores",
    code: "SCORE-05",
    title: "Pediatrik Persentil / Z-Skoru ve Klinik Skorlamalar (pGCS, PEWS, Westley Krup)",
    category: "clinical_scores",
    categoryLabel: "Büyüme & Klinik Skorlamalar",
    summary:
      "WHO ve Neyzi büyüme persentilleri ile Pediatrik Glasgow Koma Skalası (pGCS), PEWS ve Westley Krup şiddet skoru.",
    plannedInputs: [
      "Yaş, Cinsiyet, Boy, Kilo, Baş Çevresi",
      "Göz/Verbal/Motor Yanıt (pGCS)",
      "Stridor/Çekilme/Siyanoz (Westley)",
    ],
    plannedOutputs: [
      "Boy/Kilo/VKİ SDS ve Persentil",
      "pGCS Toplam Skoru (3–15)",
      "PEWS & Westley Krup Klinik Karar Önerisi",
    ],
    clinicalProtocolNote:
      "Türk çocukları için Neyzi referans tabloları ve WHO 0-5 yaş standartları birlikte sunulacaktır.",
    maxDoseGuardrailNote: "pGCS <= 8 veya Westley >= 8 durumunda Çocuk Yoğun Bakım konsültasyon uyarısı verilir.",
    formulaVersion: "v1.0-placeholder",
    isActive: true,
    status: "placeholder_ready",
  },
];
