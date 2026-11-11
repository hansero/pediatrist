/**
 * Callable API sözleşmeleri (istemci ↔ sunucu). Her callable için zod İSTEK ve YANIT şeması.
 *
 * - Sunucu, isteği F1.3'te `validate.ts` ile bu şemalarla doğrular (istemci doğrulamasına güvenilmez).
 * - İstemci, F1.4'te yanıtı aynı şemalarla doğrular (sunucu ile istemci tipleri ayrışamaz).
 * - Takma ad parametreler kaldırıldı (eskiden `dynamicCode|dynamicToken`, `deviceId|clientDeviceSecret`,
 *   `resetBoundDevice|resetDeviceBinding` birlikte kabul ediliyordu).
 * - Kendi beyanına dayalı `webAuthnVerified` bayrağı kabul edilmez; gerçek WebAuthn doğrulaması F4.2'de
 *   bu sözleşmeye `assertion` alanı olarak eklenir.
 *
 * Zamana bağlı kurallar (ör. `closesAtMs` gelecekte olmalı) şemada değil, handler'da denetlenir; şemalar saftır.
 * Soru alanları arası kurallar (seçenek ⇔ doğru cevap, Text Input ⇔ maxLength) `quizQuestion.ts` içindedir ve
 * admin CSV önizlemesiyle ortaktır.
 */
import { KVKK_NOTICE_VERSION } from "./consent";
import { z } from "./zod";
import { QuizQuestionInput } from "./quizQuestion";
import {
  CALCULATOR_IDS,
  MATERIAL_CATEGORIES,
  MATERIAL_FILE_TYPES,
  MATERIAL_UPLOAD,
  DEFAULT_REVEAL_POLICY,
  REVEAL_POLICIES,
  ATTENDANCE_CODE_ALPHABET,
  ATTENDANCE_CODE_LENGTH,
  LIMITS,
  MEMBER_STATUSES,
  QUESTION_TYPES,
  RESIDENCY_YEARS,
  ROLES,
  TITLES,
  isResidentTitle,
} from "./constants";

// --- Yardımcı tipler ----------------------------------------------------------

/** Firestore doküman kimliği: boş olamaz, `/` içeremez. */
export const docId = (label: string) =>
  z
    .string({ error: `${label} zorunludur.` })
    .trim()
    .min(1, { error: `${label} zorunludur.` })
    .max(LIMITS.idLength, { error: `${label} geçersiz.` })
    .refine((v) => !v.includes("/") && v !== "." && v !== "..", { error: `${label} geçersiz.` });

/** Kırpılmış zorunlu metin. */
export const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} zorunludur.` })
    .trim()
    .min(1, { error: `${label} zorunludur.` })
    .max(max, { error: `${label} en fazla ${max} karakter olabilir.` });

/** Kırpılmış isteğe bağlı metin (yoksa ""). */
export const optionalText = (label: string, max: number) =>
  z
    .string({ error: `${label} metin olmalıdır.` })
    .trim()
    .max(max, { error: `${label} en fazla ${max} karakter olabilir.` })
    .optional()
    .transform((v) => v ?? "");

export const intInRange = (label: string, min: number, max: number) =>
  z
    .number({ error: `${label} sayı olmalıdır.` })
    .int({ error: `${label} tam sayı olmalıdır.` })
    .min(min, { error: `${label} ${min}–${max} arasında olmalıdır.` })
    .max(max, { error: `${label} ${min}–${max} arasında olmalıdır.` });

/** Epoch milisaniye (geçmiş/gelecek kontrolü handler'dadır). */
export const epochMs = (label: string) =>
  z
    .number({ error: `${label} geçersiz.` })
    .int({ error: `${label} geçersiz.` })
    .positive({ error: `${label} geçersiz.` });

const roleSchema = z.enum(ROLES, { error: "Rol 'admin' veya 'user' olmalıdır." });
const statusSchema = z.enum(MEMBER_STATUSES, { error: "Durum 'active', 'pending' veya 'suspended' olmalıdır." });
const residencyYearSchema = z.union(
  RESIDENCY_YEARS.map((y) => z.literal(y)),
  { error: "Kıdem yılı 1–4 arasında olmalıdır." }
);

// --- Üyelik ---------------------------------------------------------------------

export const UpdateMemberAccessRequest = z
  .object({
    targetUid: docId("Hedef kullanıcı"),
    role: roleSchema.optional(),
    status: statusSchema.optional(),
    residencyYear: residencyYearSchema.optional(),
    resetBoundDevice: z.boolean().optional(),
  })
  .refine(
    (v) => v.role !== undefined || v.status !== undefined || v.residencyYear !== undefined || v.resetBoundDevice,
    { error: "Değiştirilecek en az bir alan gönderilmelidir." }
  );
export const UpdateMemberAccessResponse = z.object({
  ok: z.literal(true),
  targetUid: z.string(),
  role: roleSchema,
  status: statusSchema,
  residencyYear: z.number().nullable(),
});

/** Davet kodu: büyük harfe çevrilir; harf, rakam ve tire. */
export const invitationCode = z
  .string({ error: "Davet kodu metin olmalıdır." })
  .trim()
  .toUpperCase()
  .min(4, { error: "Davet kodu geçersiz." })
  .max(64, { error: "Davet kodu geçersiz." })
  .regex(/^[A-Z0-9-]+$/, { error: "Davet kodu yalnızca harf, rakam ve tire içerebilir." });

/**
 * Kayıt (F2.3): profil SUNUCUDA yazılır (D4). Rol ve durum istemciden alınmaz; e-posta token'dan okunur.
 * Davet kodu geçerliyse üyelik doğrudan aktif olur. KVKK onayı (`consentVersion`) zorunludur (F3.5).
 */
export const CompleteRegistrationRequest = z
  .object({
    title: z.enum(TITLES, { error: "Ünvan listeden seçilmelidir." }),
    fullName: requiredText("Ad soyad", LIMITS.personNameLength).refine((v) => v.length >= 2, {
      error: "Ad soyad en az 2 karakter olmalıdır.",
    }),
    /** Yalnızca asistanlar için zorunlu; diğer ünvanlarda yok sayılır ve `null` saklanır. */
    residencyYear: residencyYearSchema.optional(),
    inviteCode: z.union([invitationCode, z.literal("").transform(() => undefined)]).optional(),
    /** KVKK aydınlatma metninin okunduğu onayı: yalnızca GÜNCEL sürüm kabul edilir (F3.5). */
    consentVersion: z.literal(KVKK_NOTICE_VERSION, {
      error: "Devam etmek için güncel KVKK aydınlatma metnini okuduğunuzu onaylayın.",
    }),
  })
  .superRefine((v, ctx) => {
    if (isResidentTitle(v.title) && v.residencyYear === undefined) {
      ctx.addIssue({ code: "custom", path: ["residencyYear"], message: "Kıdem yılı seçilmelidir." });
    }
  });
// Not: dönüşüm (transform) yok; istemci şemanın ÇIKTISINI gönderir ve sunucu aynı şemayla yeniden doğrular.
// Asistan olmayanlar için `residencyYear`'ı sunucu `null` yazar (members.ts).
export const CompleteRegistrationResponse = z.object({
  status: statusSchema,
  role: roleSchema,
  alreadyRegistered: z.boolean(),
});

export const CreateInvitationRequest = z.object({
  email: z
    .string({ error: "E-posta adresi zorunludur." })
    .trim()
    .toLowerCase()
    .max(254, { error: "E-posta adresi çok uzun." })
    .pipe(z.email({ error: "Geçerli bir e-posta adresi girin." })),
  intendedRole: roleSchema,
  /** Asistan daveti için kıdem yılı; boşsa kayıt olan asistanın seçimi geçerlidir. */
  residencyYear: residencyYearSchema.optional(),
  validForDays: intInRange("Geçerlilik süresi (gün)", 1, 90).optional().default(14),
});
export const CreateInvitationResponse = z.object({
  invitationId: z.string(),
  code: z.string(),
  expiresAtMs: z.number(),
});

export const RevokeInvitationRequest = z.object({ invitationId: docId("Davet") });
export const RevokeInvitationResponse = z.object({ revoked: z.literal(true) });

/**
 * Admin: üyenin iki aşamalı doğrulama faktörlerini siler (telefonunu kaybeden üye, F3.4 → F7.1). Oturumları iptal
 * edilir; üye yeniden giriş yapıp Authenticator'ı yeniden kurar (MFA zorunluysa kurulum ekranına yönlenir).
 */
/**
 * Admin: hesaplayıcının klinik protokol notu (F7.4, D8). Boş not kaydı siler (not gösterilmez).
 * Formül/doz bilgisi DEĞİL, kurum protokolüne yönlendiren serbest metindir.
 */
export const UpdateCalculatorConfigRequest = z.object({
  calculatorId: z.enum(CALCULATOR_IDS, { error: "Hesaplayıcı bulunamadı." }),
  protocolNote: optionalText("Protokol notu", LIMITS.protocolNoteLength),
});
export const UpdateCalculatorConfigResponse = z.object({ saved: z.literal(true), cleared: z.boolean() });

export const ResetMemberMfaRequest = z.object({ targetUid: docId("Hedef kullanıcı") });
export const ResetMemberMfaResponse = z.object({ reset: z.literal(true), factorsRemoved: z.number() });

// --- Yoklama -------------------------------------------------------------------

export const attendanceCode = z
  .string({ error: "Yoklama kodu zorunludur." })
  .trim()
  .toUpperCase()
  .length(ATTENDANCE_CODE_LENGTH, { error: `Yoklama kodu ${ATTENDANCE_CODE_LENGTH} karakter olmalıdır.` })
  .refine((v) => [...v].every((ch) => ATTENDANCE_CODE_ALPHABET.includes(ch)), {
    error: "Yoklama kodu geçersiz karakter içeriyor.",
  });

export const StartLectureSessionRequest = z.object({
  title: requiredText("Ders başlığı", LIMITS.titleLength),
  lecturer: requiredText("Eğitici", LIMITS.personNameLength),
  category: optionalText("Kategori", LIMITS.titleLength).transform((v) => v || "Genel"),
  durationMinutes: intInRange("Yoklama süresi (dk)", LIMITS.lectureMinutes.min, LIMITS.lectureMinutes.max),
});
export const StartLectureSessionResponse = z.object({
  sessionId: z.string(),
  endsAtMs: z.number(),
});

export const EndLectureSessionRequest = z.object({ sessionId: docId("Oturum") });
export const EndLectureSessionResponse = z.object({ closed: z.literal(true) });

export const GetProjectorCodeRequest = z.object({ sessionId: docId("Oturum") });
export const GetProjectorCodeResponse = z.object({
  code: z.string().length(ATTENDANCE_CODE_LENGTH),
  msUntilRotation: z.number(),
  endsAtMs: z.number(),
});

// --- WebAuthn (F4.2, D6) ------------------------------------------------------------
// Tarayıcının ürettiği JSON (`@simplewebauthn/browser`) biçimce doğrulanır; kriptografik doğrulama sunucuda.

const b64url = (label: string) =>
  z
    .string({ error: `${label} eksik.` })
    .min(1, { error: `${label} eksik.` })
    .max(LIMITS.webAuthnFieldLength, { error: `${label} çok uzun.` })
    .regex(/^[A-Za-z0-9_-]+={0,2}$/, { error: `${label} geçersiz.` });

const webAuthnBase = {
  id: b64url("Kimlik bilgisi"),
  rawId: b64url("Kimlik bilgisi"),
  type: z.literal("public-key", { error: "Kimlik bilgisi türü geçersiz." }),
  clientExtensionResults: z.record(z.string(), z.unknown()),
  authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
};

export const WebAuthnRegistrationResponse = z.looseObject({
  ...webAuthnBase,
  response: z.looseObject({
    clientDataJSON: b64url("İstemci verisi"),
    attestationObject: b64url("Doğrulayıcı verisi"),
    transports: z.array(z.string().max(32)).max(10).optional(),
  }),
});

export const WebAuthnAuthenticationResponse = z.looseObject({
  ...webAuthnBase,
  response: z.looseObject({
    clientDataJSON: b64url("İstemci verisi"),
    authenticatorData: b64url("Doğrulayıcı verisi"),
    signature: b64url("İmza"),
    userHandle: b64url("Kullanıcı tanıtıcısı").optional(),
  }),
});

/** Sunucunun ürettiği tören seçenekleri; istemci olduğu gibi tarayıcıya verir. */
const WebAuthnOptionsResponse = z.object({
  options: z.looseObject({ challenge: z.string().min(16) }),
});

export const BeginDeviceRegistrationRequest = z.object({});
export const BeginDeviceRegistrationResponse = WebAuthnOptionsResponse;
export const FinishDeviceRegistrationRequest = z.object({ response: WebAuthnRegistrationResponse });
export const FinishDeviceRegistrationResponse = z.object({ registered: z.literal(true), backedUp: z.boolean() });

export const BeginAttendanceAssertionRequest = z.object({ sessionId: docId("Oturum") });
export const BeginAttendanceAssertionResponse = WebAuthnOptionsResponse;

export const VerifyRealTimeAttendanceRequest = z.object({
  sessionId: docId("Oturum"),
  code: attendanceCode,
  /** Bu cihazın passkey'iyle (kullanıcı doğrulamalı) imzalanmış challenge (F4.2). */
  assertion: WebAuthnAuthenticationResponse,
});
export const VerifyRealTimeAttendanceResponse = z.object({
  verified: z.literal(true),
  alreadyRecorded: z.boolean(),
});

export const MarkAttendanceExcusedRequest = z.object({
  sessionId: docId("Oturum"),
  targetUid: docId("Hekim"),
  excuseNote: optionalText("Mazeret notu", LIMITS.excuseNoteLength),
});
export const MarkAttendanceExcusedResponse = z.object({ ok: z.literal(true) });

// --- Sınav ----------------------------------------------------------------------

const quizMinutes = intInRange("Sınav süresi (dk)", LIMITS.quizMinutes.min, LIMITS.quizMinutes.max);
const revealPolicy = z.enum(REVEAL_POLICIES, {
  error: "Sonuç gösterimi 'after_close' (sınav kapanınca) veya 'immediate' (hemen) olmalıdır.",
});
const quizQuestions = z
  .array(QuizQuestionInput, { error: "Sorular liste olmalıdır." })
  .min(LIMITS.quizQuestions.min, { error: `Sınav en az ${LIMITS.quizQuestions.min} soru içermelidir.` })
  .max(LIMITS.quizQuestions.max, { error: `Sınav en fazla ${LIMITS.quizQuestions.max} soru içerebilir.` });

export const SaveQuizDraftRequest = z.object({
  title: requiredText("Sınav başlığı", LIMITS.titleLength),
  durationMinutes: quizMinutes,
  closesAtMs: epochMs("Kapanış zamanı").nullable().optional(),
  revealPolicy: revealPolicy.optional().default(DEFAULT_REVEAL_POLICY),
  sourceFileName: optionalText("Kaynak dosya adı", LIMITS.fileNameLength),
  questions: quizQuestions,
});
export const SaveQuizDraftResponse = z.object({ quizId: z.string(), questionCount: z.number() });

/** Yalnızca taslak güncellenir; verilmeyen alanlar değişmez. `questions` verilirse soru seti tamamen değişir. */
export const UpdateQuizDraftRequest = z.object({
  quizId: docId("Sınav"),
  title: requiredText("Sınav başlığı", LIMITS.titleLength).optional(),
  durationMinutes: quizMinutes.optional(),
  closesAtMs: epochMs("Kapanış zamanı").nullable().optional(),
  revealPolicy: revealPolicy.optional(),
  sourceFileName: z
    .string({ error: "Kaynak dosya adı metin olmalıdır." })
    .trim()
    .max(LIMITS.fileNameLength, { error: `Kaynak dosya adı en fazla ${LIMITS.fileNameLength} karakter olabilir.` })
    .optional(),
  questions: quizQuestions.optional(),
});
export const UpdateQuizDraftResponse = z.object({ quizId: z.string(), questionCount: z.number() });

export const DeleteQuizDraftRequest = z.object({ quizId: docId("Sınav") });
export const DeleteQuizDraftResponse = z.object({ deleted: z.literal(true) });

/**
 * Yayın: yayındaki sınav kapatılıp arşivlenir. O sınavda devam eden girişim varsa ve `force` verilmemişse yayın
 * YAPILMAZ; sayı döner, istemci onay alıp `force: true` ile tekrar çağırır (devam edenler süreleri dolana
 * kadar teslim edebilir).
 */
export const PublishQuizRequest = z.object({
  quizId: docId("Sınav"),
  durationMinutes: quizMinutes.optional(),
  closesAtMs: epochMs("Kapanış zamanı").nullable().optional(),
  revealPolicy: revealPolicy.optional(),
  force: z.boolean({ error: "force evet/hayır olmalıdır." }).optional().default(false),
});
export const PublishQuizResponse = z.discriminatedUnion("published", [
  z.object({ published: z.literal(true), archivedPreviousCount: z.number() }),
  z.object({ published: z.literal(false), inProgressCount: z.number(), currentQuizTitle: z.string() }),
]);

export const CloseQuizRequest = z.object({ quizId: docId("Sınav") });
export const CloseQuizResponse = z.object({
  closed: z.literal(true),
  /** Kapanışta süresi devam eden girişim sayısı (süreleri dolana kadar teslim edebilirler). */
  inProgressCount: z.number(),
  /** `after_close` karnesinin açılacağı an. */
  revealAtMs: z.number(),
});

/** Hekimin sınavda gördüğü soru: 1–7. alanlar; doğru cevap ve feedback YOK. Görsel Storage yolu olarak gelir. */
export const AttemptQuestionSchema = z.object({
  questionId: z.string(),
  orderIndex: z.number(),
  caseContent: z.string(),
  imagePath: z.string(),
  questionText: z.string(),
  questionType: z.enum(QUESTION_TYPES),
  maxLength: z.number(),
  options: z.array(z.string()),
});

/** Soru kimliği → yanıt(lar). Kayıt ve teslimde aynı biçim. */
const attemptResponses = z
  .record(
    z.string().max(LIMITS.idLength),
    z.array(z.string().max(LIMITS.textAnswerLength.max)).max(20, { error: "Bir soruya en fazla 20 yanıt." }),
    { error: "Yanıtlar geçersiz." }
  )
  .refine((r) => Object.keys(r).length <= LIMITS.quizQuestions.max, { error: "Yanıtlar geçersiz." });

export const StartQuizAttemptRequest = z.object({ quizId: docId("Sınav") });
export const StartQuizAttemptResponse = z.object({
  attemptId: z.string(),
  quizTitle: z.string(),
  deadlineMs: z.number(),
  /** Yanıt anındaki sunucu saati: istemci, cihaz saati yanlışsa geri sayımı buna göre düzeltir. */
  serverNowMs: z.number(),
  resumed: z.boolean(),
  revealPolicy,
  questions: z.array(AttemptQuestionSchema),
  /** Süre içinde kaydedilmiş yanıtlar (devam ederken geri yüklenir). */
  savedResponses: z.record(z.string(), z.array(z.string())),
});

export const SaveAttemptDraftRequest = z.object({ quizId: docId("Sınav"), responses: attemptResponses });
export const SaveAttemptDraftResponse = z.object({ savedAtMs: z.number() });

export const SubmitQuizAttemptRequest = z.object({
  quizId: docId("Sınav"),
  responses: attemptResponses,
  tabSwitchCount: z.number().int().min(0).max(LIMITS.tabSwitchCountMax).optional().default(0),
});

export const GradedItemSchema = z.object({
  questionId: z.string(),
  orderIndex: z.number(),
  caseContent: z.string(),
  imageUrl: z.string(),
  questionText: z.string(),
  questionType: z.enum(QUESTION_TYPES),
  options: z.array(z.string()),
  isCorrect: z.boolean(),
  userResponse: z.array(z.string()),
  /** Yalnızca karne açıksa (D7) dolu. */
  correctAnswers: z.array(z.string()).nullable(),
  feedbackText: z.string().nullable(),
});

const attemptReport = {
  attemptId: z.string(),
  score: z.number(),
  correctCount: z.number(),
  totalQuestions: z.number(),
  lateSubmission: z.boolean(),
  /** Doğru cevaplar ve Feedback_Text bu yanıtta var mı (D7)? */
  revealed: z.boolean(),
  /** Karne kapalıysa açılacağı an (biliniyorsa); `immediate` veya açıksa `null`. */
  revealAtMs: z.number().nullable(),
  items: z.array(GradedItemSchema),
};

export const SubmitQuizAttemptResponse = z.object(attemptReport);

export const GetAttemptReportRequest = z.object({ attemptId: docId("Sınav girişimi") });
export const GetAttemptReportResponse = z.object({
  ...attemptReport,
  quizId: z.string(),
  quizTitle: z.string(),
  uid: z.string(),
  doctorName: z.string(),
  submittedAtMs: z.number(),
  autoSubmitted: z.boolean(),
});

// --- Materyaller (F6.1) -----------------------------------------------------------

const materialFields = {
  title: requiredText("Materyal başlığı", LIMITS.titleLength),
  description: optionalText("Açıklama", LIMITS.descriptionLength),
  category: z.enum(MATERIAL_CATEGORIES, { error: "Kategori listeden seçilmelidir." }),
  targetYears: z
    .array(residencyYearSchema, { error: "Hedef kıdem listesi geçersiz." })
    .min(1, { error: "En az bir hedef kıdem seçin." })
    .max(RESIDENCY_YEARS.length)
    .refine((ys) => new Set(ys).size === ys.length, { error: "Hedef kıdem tekrarlanamaz." }),
  isMandatory: z.boolean({ error: "Zorunluluk evet/hayır olmalıdır." }),
  allowDownload: z.boolean({ error: "İndirme izni evet/hayır olmalıdır." }),
};

const materialContentType = z.enum(Object.keys(MATERIAL_UPLOAD.contentTypes) as [string, ...string[]], {
  error: "Yalnızca PDF, video (MP4/WebM/MOV) veya görsel (PNG/JPEG/WebP) yüklenebilir. Sunumları PDF olarak yükleyin.",
});

/** Taslak + yükleme yolu. Dosyayı istemci bu yola yükler (Storage kuralı admin, tür ve boyut denetler). */
export const CreateMaterialRequest = z.object({
  ...materialFields,
  fileName: requiredText("Dosya adı", LIMITS.fileNameLength),
  contentType: materialContentType,
  sizeBytes: z
    .number({ error: "Dosya boyutu geçersiz." })
    .int()
    .positive({ error: "Dosya boş." })
    .max(MATERIAL_UPLOAD.maxMb * 1024 * 1024, { error: `Dosya en fazla ${MATERIAL_UPLOAD.maxMb} MB olabilir.` }),
});
export const CreateMaterialResponse = z.object({ materialId: z.string(), storagePath: z.string() });

/** Yükleme bitti: sunucu dosyayı Storage'da denetler (var mı, tür, boyut) ve yayınlar. */
export const FinalizeMaterialUploadRequest = z.object({ materialId: docId("Materyal") });
export const FinalizeMaterialUploadResponse = z.object({
  published: z.literal(true),
  sizeBytes: z.number(),
  fileType: z.enum(MATERIAL_FILE_TYPES),
});

export const UpdateMaterialRequest = z.object({ materialId: docId("Materyal") }).extend(
  Object.fromEntries(Object.entries(materialFields).map(([k, v]) => [k, v.optional()])) as {
    [K in keyof typeof materialFields]: z.ZodOptional<(typeof materialFields)[K]>;
  }
);
export const UpdateMaterialResponse = z.object({ updated: z.literal(true) });

/** Doküman, Storage dosyası ve bütün okuma ilerlemeleri silinir. */
export const DeleteMaterialRequest = z.object({ materialId: docId("Materyal") });
export const DeleteMaterialResponse = z.object({ deleted: z.literal(true), progressDeleted: z.number() });

// --- Kayıt defteri --------------------------------------------------------------

/**
 * Callable adı → sözleşme. İstemci çağrı katmanı (F1.4) ve sunucu doğrulaması (F1.3) buradan beslenir.
 * Yeni bir callable eklendiğinde önce buraya eklenir.
 */
export const CALLABLES = {
  updateMemberAccess: { request: UpdateMemberAccessRequest, response: UpdateMemberAccessResponse },
  completeRegistration: { request: CompleteRegistrationRequest, response: CompleteRegistrationResponse },
  createInvitation: { request: CreateInvitationRequest, response: CreateInvitationResponse },
  revokeInvitation: { request: RevokeInvitationRequest, response: RevokeInvitationResponse },
  resetMemberMfa: { request: ResetMemberMfaRequest, response: ResetMemberMfaResponse },
  startLectureSession: { request: StartLectureSessionRequest, response: StartLectureSessionResponse },
  endLectureSession: { request: EndLectureSessionRequest, response: EndLectureSessionResponse },
  getProjectorCode: { request: GetProjectorCodeRequest, response: GetProjectorCodeResponse },
  beginDeviceRegistration: { request: BeginDeviceRegistrationRequest, response: BeginDeviceRegistrationResponse },
  finishDeviceRegistration: { request: FinishDeviceRegistrationRequest, response: FinishDeviceRegistrationResponse },
  beginAttendanceAssertion: { request: BeginAttendanceAssertionRequest, response: BeginAttendanceAssertionResponse },
  verifyRealTimeAttendance: { request: VerifyRealTimeAttendanceRequest, response: VerifyRealTimeAttendanceResponse },
  markAttendanceExcused: { request: MarkAttendanceExcusedRequest, response: MarkAttendanceExcusedResponse },
  saveQuizDraft: { request: SaveQuizDraftRequest, response: SaveQuizDraftResponse },
  publishQuiz: { request: PublishQuizRequest, response: PublishQuizResponse },
  closeQuiz: { request: CloseQuizRequest, response: CloseQuizResponse },
  startQuizAttempt: { request: StartQuizAttemptRequest, response: StartQuizAttemptResponse },
  submitQuizAttempt: { request: SubmitQuizAttemptRequest, response: SubmitQuizAttemptResponse },
  updateQuizDraft: { request: UpdateQuizDraftRequest, response: UpdateQuizDraftResponse },
  deleteQuizDraft: { request: DeleteQuizDraftRequest, response: DeleteQuizDraftResponse },
  saveAttemptDraft: { request: SaveAttemptDraftRequest, response: SaveAttemptDraftResponse },
  getAttemptReport: { request: GetAttemptReportRequest, response: GetAttemptReportResponse },
  createMaterial: { request: CreateMaterialRequest, response: CreateMaterialResponse },
  finalizeMaterialUpload: { request: FinalizeMaterialUploadRequest, response: FinalizeMaterialUploadResponse },
  updateMaterial: { request: UpdateMaterialRequest, response: UpdateMaterialResponse },
  deleteMaterial: { request: DeleteMaterialRequest, response: DeleteMaterialResponse },
  updateCalculatorConfig: { request: UpdateCalculatorConfigRequest, response: UpdateCalculatorConfigResponse },
} as const;

export type CallableName = keyof typeof CALLABLES;
/** İstemcinin gönderdiği (dönüşüm ÖNCESİ) istek tipi. */
export type CallableRequestInput<N extends CallableName> = z.input<(typeof CALLABLES)[N]["request"]>;
/** Sunucunun doğrulama SONRASI gördüğü istek tipi. */
export type CallableRequestData<N extends CallableName> = z.output<(typeof CALLABLES)[N]["request"]>;
export type CallableResponse<N extends CallableName> = z.output<(typeof CALLABLES)[N]["response"]>;
