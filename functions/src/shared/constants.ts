/**
 * İstemci ve sunucunun ORTAK sabitleri (CLAUDE.md kural 4: aynı sabit iki yerde tanımlanmaz).
 *
 * Bu klasör (`functions/src/shared`) hem Cloud Functions tarafından (göreli import ile)
 * hem Next.js tarafından (`@shared/*` alias'ı ile) kullanılır. Bu yüzden burada:
 *  - Node'a veya tarayıcıya özgü API kullanılmaz,
 *  - Firebase SDK'larından (client/admin) import yapılmaz,
 *  - yalnızca `zod` ve saf TypeScript bulunur.
 */

/** Cloud Functions bölgesi (D10). */
export const REGION = "europe-west1";

// --- Üyelik ---------------------------------------------------------------

export const ROLES = ["admin", "user"] as const;
export type Role = (typeof ROLES)[number];

export const MEMBER_STATUSES = ["active", "pending", "suspended"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const TITLES = ["Asistan Dr.", "Uzm. Dr.", "Doç. Dr.", "Prof. Dr."] as const;
export type Title = (typeof TITLES)[number];

export const RESIDENCY_YEARS = [1, 2, 3, 4] as const;
export type ResidencyYear = (typeof RESIDENCY_YEARS)[number];

/** Kıdem yılı yalnızca bu ünvan için anlamlıdır; uzman/öğretim üyelerinde `residencyYear` `null`'dır (F3.5). */
export const RESIDENT_TITLE: Title = "Asistan Dr.";
export const isResidentTitle = (title: string): boolean => title === RESIDENT_TITLE;

// --- Yoklama ---------------------------------------------------------------

/** Projektör kodunun yenilenme aralığı. Bir önceki pencere ağ gecikmesi toleransı olarak kabul edilir. */
export const ATTENDANCE_SLOT_MS = 15_000;
/** Karışıklık yaratan 0/O/1/I karakterleri yoktur. */
export const ATTENDANCE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ATTENDANCE_CODE_LENGTH = 6;

/**
 * Katılım uyarı eşiği (F4.5): katıldı / (katıldı + katılmadı) bu değerin altındaysa hekim raporda işaretlenir.
 * Mazeretli dersler paydaya girmez.
 */
export const ATTENDANCE_WARN_RATE = 0.7;

/** WebAuthn tören (kayıt/yoklama) challenge'ının geçerlilik süresi (F4.2). */
export const WEBAUTHN_CHALLENGE_TTL_MS = 2 * 60_000;

export const LECTURE_CATEGORIES = [
  "Sabah Vaka & Makale Saati",
  "Çekirdek Eğitim Semineri",
  "Mortalite & Morbidite Konseyi",
  "Yatak Başı Klinik Pratik",
] as const;
export type LectureCategory = (typeof LECTURE_CATEGORIES)[number];

// --- Sınav -----------------------------------------------------------------

export const QUESTION_TYPES = ["Single Choice", "Multiple Choice", "Text Input"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Süre dolduktan sonra teslim için ağ gecikmesi toleransı. */
export const QUIZ_SUBMIT_GRACE_MS = 30_000;

/**
 * Sonuç gösterim politikası (D7): `after_close` (varsayılan) sınav kapanıp son girişimin süresi dolana kadar
 * yalnızca puan ve doğru/yanlış; `immediate` teslimde tam karne (doğru cevap + Feedback_Text).
 */
export const REVEAL_POLICIES = ["after_close", "immediate"] as const;
export type RevealPolicy = (typeof REVEAL_POLICIES)[number];
export const DEFAULT_REVEAL_POLICY: RevealPolicy = "after_close";

// --- Hesaplayıcılar (D8) ---------------------------------------------------

/**
 * Planlanan pediatri hesaplayıcılarının kimlikleri (F7.4). Formül motoru bu revizyonda yok (D8); kimlikler
 * `calculators_config/{id}` protokol notlarının anahtarıdır ve istemci kataloğu bunlara bağlıdır.
 */
export const CALCULATOR_IDS = [
  "calc_holliday_segar",
  "calc_bsa_schwartz",
  "calc_pals_emergency",
  "calc_neonatal_bilirubin",
  "calc_growth_clinical_scores",
] as const;
export type CalculatorId = (typeof CALCULATOR_IDS)[number];

// --- Materyaller -----------------------------------------------------------

/** Tek kategori listesi: hem yükleme hem filtreleme bunu kullanır (AUDIT kullanılabilirlik bulgusu). */
export const MATERIAL_CATEGORIES = [
  "Çocuk Acil & Yoğun Bakım",
  "Neonatoloji (Yenidoğan)",
  "Çocuk Enfeksiyon",
  "Çocuk Nefroloji & Sıvı",
  "Çocuk Kardiyoloji",
  "Genel Pediatri",
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export const MATERIAL_FILE_TYPES = ["pdf", "video", "image"] as const;
export type MaterialFileType = (typeof MATERIAL_FILE_TYPES)[number];

/**
 * Storage'a yüklenebilen içerik türleri ve boyut sınırları. `storage.rules` ile AYNI olmalıdır
 * (tests/unit/storageRulesSync.test.ts denetler). Sunumlar PDF olarak yüklenir (D19); SVG kabul edilmez.
 */
export const MATERIAL_UPLOAD = {
  maxMb: 150,
  contentTypes: {
    "application/pdf": "pdf",
    "video/mp4": "video",
    "video/webm": "video",
    "video/quicktime": "video",
    "image/png": "image",
    "image/jpeg": "image",
    "image/webp": "image",
  } as const satisfies Record<string, MaterialFileType>,
} as const;

export const QUIZ_MEDIA_UPLOAD = {
  maxMb: 15,
  contentTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"] as const,
} as const;

// --- Denetim kaydı ---------------------------------------------------------

export const AUDIT_SEVERITIES = ["INFO", "WARN", "CRITICAL"] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

export const AUDIT_RESOURCE_TYPES = ["auth", "materials", "calculators", "attendance", "quizzes", "admin"] as const;
export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];

// --- Sınırlar ---------------------------------------------------------------

/**
 * Girdi sınırları. Sunucu doğrulaması (zod şemaları) ve form kısıtları aynı değerleri kullanır.
 * Not: Yoklama süresi eskiden arayüzde 180, sunucuda 240 dk idi; tek değer 240'tır.
 */
export const LIMITS = {
  lectureMinutes: { min: 1, max: 240 },
  quizMinutes: { min: 1, max: 180 },
  quizQuestions: { min: 1, max: 200 },
  textAnswerLength: { min: 1, max: 2000 },
  optionLength: 500,
  caseContentLength: 5000,
  questionTextLength: 2000,
  feedbackTextLength: 5000,
  imagePathLength: 1000,
  titleLength: 200,
  personNameLength: 120,
  excuseNoteLength: 200,
  fileNameLength: 200,
  descriptionLength: 2000,
  protocolNoteLength: 2000,
  idLength: 128,
  /** WebAuthn yanıtındaki base64url alanlar (imza, authenticatorData, attestation) için üst sınır. */
  webAuthnFieldLength: 16_384,
  tabSwitchCountMax: 999,
} as const;
