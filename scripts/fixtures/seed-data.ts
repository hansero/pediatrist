/**
 * Emülatör test verisi (YALNIZCA `scripts/seed-emulator.ts` tarafından kullanılır).
 *
 * Kural (D1): Bu dosyadaki hiçbir değer uygulama kodundan (`src/`, `functions/src/`) import
 * edilemez. İsimler kurgusal test kişileridir; e-posta alanı `.test` (RFC 2606, gerçek olamaz).
 *
 * Şema notu: Dokümanlar, sunucu kodunun BUGÜN yazdığı şemayı izler. Şema değiştiğinde seed de
 * aynı adımda güncellenir: kullanıcılar → F2.3, yoklama → F4.1, materyaller → F6.1,
 * sınavlar → F5.1 (sınavlar callable'lar üzerinden oluşturulacak; bkz. REVISION_PLAN F0.4).
 */

export const SEED_PASSWORD = "Pediatrist-Test-2026!";

export type SeedRole = "admin" | "user";
export type SeedStatus = "active" | "pending" | "suspended";

export interface SeedUser {
  uid: string;
  email: string;
  title: string;
  fullName: string;
  residencyYear: number;
  role: SeedRole;
  status: SeedStatus;
}

export const SEED_USERS: SeedUser[] = [
  {
    uid: "seed-admin",
    email: "egitim.sorumlusu@pediatrist.test",
    title: "Prof. Dr.",
    fullName: "Nevin Aydoğan",
    residencyYear: 4,
    role: "admin",
    status: "active",
  },
  {
    uid: "seed-asistan-1",
    email: "asistan1@pediatrist.test",
    title: "Asistan Dr.",
    fullName: "Kerem Yalçın",
    residencyYear: 1,
    role: "user",
    status: "active",
  },
  {
    uid: "seed-asistan-2",
    email: "asistan2@pediatrist.test",
    title: "Asistan Dr.",
    fullName: "Selin Ateş",
    residencyYear: 2,
    role: "user",
    status: "active",
  },
  {
    uid: "seed-asistan-3",
    email: "asistan3@pediatrist.test",
    title: "Asistan Dr.",
    fullName: "Emre Koç",
    residencyYear: 3,
    role: "user",
    status: "active",
  },
  {
    uid: "seed-asistan-4",
    email: "asistan4@pediatrist.test",
    title: "Asistan Dr.",
    fullName: "Zeynep Ergin",
    residencyYear: 4,
    role: "user",
    status: "active",
  },
  {
    uid: "seed-bekleyen",
    email: "bekleyen@pediatrist.test",
    title: "Asistan Dr.",
    fullName: "Barış Demirtaş",
    residencyYear: 1,
    role: "user",
    status: "pending",
  },
  {
    uid: "seed-askida",
    email: "askida@pediatrist.test",
    title: "Asistan Dr.",
    fullName: "Ceren Uysal",
    residencyYear: 2,
    role: "user",
    status: "suspended",
  },
];

/** Plan.MD §5 şeması: email, intendedRole, residencyYear, invitedBy, expiresAt, used. */
export const SEED_INVITATION = {
  id: "seed-davet-001",
  code: "DAVET-TEST-001",
  email: "davetli@pediatrist.test",
  intendedRole: "user" as const,
  residencyYear: 1,
  validForDays: 30,
};

export interface SeedMaterial {
  id: string;
  title: string;
  description: string;
  category: string;
  targetYears: number[];
  isMandatory: boolean;
  allowDownload: boolean;
  file: { local: string; name: string; contentType: string };
}

export const SEED_MATERIALS: SeedMaterial[] = [
  {
    id: "seed-mat-septik-sok",
    title: "Pediatrik Septik Şok: İlk Saat Yönetimi",
    description: "Kompanse şokun erken tanısı, sıvı resüsitasyonu ve vazoaktif tedaviye geçiş ölçütleri.",
    category: "Çocuk Acil & Yoğun Bakım",
    targetYears: [1, 2, 3, 4],
    isMandatory: true,
    allowDownload: false,
    file: { local: "septik-sok-ilk-saat.pdf", name: "septik-sok-ilk-saat.pdf", contentType: "application/pdf" },
  },
  {
    id: "seed-mat-preterm",
    title: "Doğumhanede Preterm Yenidoğan Stabilizasyonu",
    description: "Termoregülasyon, CPAP ve başlangıç FiO2 titrasyonu.",
    category: "Neonatoloji (Yenidoğan)",
    targetYears: [1, 2],
    isMandatory: false,
    allowDownload: true,
    file: { local: "preterm-stabilizasyon.pdf", name: "preterm-stabilizasyon.pdf", contentType: "application/pdf" },
  },
];

/** Sınav görselleri: CSV fixture'ı (`quiz-ornek.csv`) bu yola başvurur. */
export const SEED_QUIZ_MEDIA = [
  { local: "steeple_sign.png", path: "quiz_media/steeple_sign.png", contentType: "image/png" },
];

/** Geçmiş (kapanmış) bir yoklama oturumu ve katılım durumları. */
export const SEED_ATTENDANCE = {
  id: "seed-ders-001",
  title: "Sabah Olgu Sunumu: Ateşli Süt Çocuğuna Yaklaşım",
  lecturer: "Prof. Dr. Nevin Aydoğan",
  category: "Sabah Vaka & Makale Saati",
  durationMinutes: 15,
  daysAgo: 2,
  records: [
    { uid: "seed-asistan-1", status: "present" as const, minuteOffset: 1 },
    { uid: "seed-asistan-2", status: "present" as const, minuteOffset: 2 },
    { uid: "seed-asistan-3", status: "excused" as const, minuteOffset: 5, excuseNote: "Nöbet ertesi" },
    // seed-asistan-4 katılmadı (kayıt yok)
  ],
};
