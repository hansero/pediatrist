import { CALCULATOR_IDS, type CalculatorId } from "@shared/constants";

/**
 * Planlanan pediatri hesaplayıcıları (F7.4, D8). Bu bir ÜRÜN YOL HARİTASIDIR: formül motoru bu revizyonda
 * yoktur ve hiçbir hesaplama yapılmaz. Aşağıdaki "planlanan" güvenlik denetimleri henüz ÇALIŞMAZ ve arayüzde
 * öyle etiketlenir. Kliniğe özgü protokol notu burada değil, `calculators_config/{id}`'de (admin yazar) tutulur.
 */
export interface PlannedCalculator {
  id: CalculatorId;
  code: string;
  title: string;
  categoryLabel: string;
  summary: string;
  plannedInputs: string[];
  plannedOutputs: string[];
  /** Formül motoruyla birlikte gelecek güvenlik denetimi (şu an etkin DEĞİL). */
  plannedSafetyCheck: string;
}

const CATALOG: Record<CalculatorId, Omit<PlannedCalculator, "id">> = {
  calc_holliday_segar: {
    code: "SIVI-01",
    title: "Holliday-Segar idame ve defisit sıvı",
    categoryLabel: "Sıvı ve elektrolit",
    summary: "Kilo ve dehidratasyon derecesine göre 24 saatlik idame sıvı, saatlik hız ve defisit replasman planı.",
    plannedInputs: ["Vücut ağırlığı (kg)", "Dehidratasyon derecesi (%)", "Serum sodyum (mEq/L)"],
    plannedOutputs: ["Günlük idame (mL/24 sa)", "Saatlik infüzyon hızı (mL/sa)", "Defisit + idame planı"],
    plannedSafetyCheck: "Günlük toplam idame sıvı için üst sınır uyarısı.",
  },
  calc_bsa_schwartz: {
    code: "BÖBREK-02",
    title: "Vücut yüzey alanı (Mosteller) ve yatak başı Schwartz eGFR",
    categoryLabel: "Antropometri ve böbrek fonksiyonu",
    summary: "İlaç dozlaması için Mosteller VYA (m²) ve boy / serum kreatinin ile pediatrik eGFR.",
    plannedInputs: ["Boy (cm)", "Vücut ağırlığı (kg)", "Serum kreatinin (mg/dL)"],
    plannedOutputs: ["Mosteller VYA (m²)", "Schwartz eGFR (mL/dk/1,73 m²)", "KDIGO evresi"],
    plannedSafetyCheck: "Düşük eGFR'de böbrek yoluyla atılan ilaçlar için doz uyarısı.",
  },
  calc_pals_emergency: {
    code: "PALS-03",
    title: "Pediatrik acil / PALS resüsitasyon dozları",
    categoryLabel: "Çocuk acil ve resüsitasyon",
    summary: "Kiloya göre resüsitasyon ilaç dozları, endotrakeal tüp çapı/derinliği ve defibrilasyon enerjisi.",
    plannedInputs: ["Vücut ağırlığı (kg)", "Yaş (ay / yıl)", "Klinik senaryo"],
    plannedOutputs: ["İlaç dozları (mg ve mL)", "Tüp çapı (mm) ve derinliği (cm)", "Defibrilasyon (J)"],
    plannedSafetyCheck: "Her ilaç için tek doz üst sınırının (erişkin dozu) aşılmasını engelleyen kilit.",
  },
  calc_neonatal_bilirubin: {
    code: "YD-04",
    title: "Yenidoğan fototerapi ve kan değişimi eşikleri",
    categoryLabel: "Neonatoloji",
    summary: "Gebelik haftası, postnatal saat ve nörotoksisite risk faktörlerine göre bilirubin eşikleri.",
    plannedInputs: ["Gebelik haftası", "Postnatal yaş (saat)", "Total serum bilirubin (mg/dL)", "Risk faktörleri"],
    plannedOutputs: ["Fototerapi eşiği (mg/dL)", "Kan değişimi eşiği (mg/dL)", "Düzeltilmiş yaş"],
    plannedSafetyCheck: "İlk 24 saatte görülen sarılık için patolojik sarılık uyarısı.",
  },
  calc_growth_clinical_scores: {
    code: "SKOR-05",
    title: "Büyüme persentilleri ve klinik skorlar (pGKS, PEWS, Westley)",
    categoryLabel: "Büyüme ve klinik skorlar",
    summary: "Büyüme persentil / z-skorları ile pediatrik Glasgow koma skalası, PEWS ve Westley krup skoru.",
    plannedInputs: ["Yaş, cinsiyet, boy, kilo, baş çevresi", "pGKS yanıtları", "Westley bulguları"],
    plannedOutputs: ["Persentil ve z-skoru", "pGKS toplamı (3–15)", "PEWS ve Westley skoru"],
    plannedSafetyCheck: "Ağır skorlarda yoğun bakım konsültasyonu uyarısı.",
  },
};

/** Paylaşılan kimlik sırasıyla katalog (kimlik listesi tek kaynaktır: `@shared/constants`). */
export const PLANNED_CALCULATORS: PlannedCalculator[] = CALCULATOR_IDS.map((id) => ({ id, ...CATALOG[id] }));
