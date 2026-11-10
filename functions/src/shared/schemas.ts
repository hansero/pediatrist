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

export const VerifyRealTimeAttendanceRequest = z.object({
  sessionId: docId("Oturum"),
  code: attendanceCode,
  deviceId: z
    .string({ error: "Cihaz kimliği zorunludur." })
    .min(LIMITS.deviceIdLength.min, { error: "Cihaz kimliği geçersiz." })
    .max(LIMITS.deviceIdLength.max, { error: "Cihaz kimliği geçersiz." }),
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

export const SaveQuizDraftRequest = z.object({
  title: requiredText("Sınav başlığı", LIMITS.titleLength),
  durationMinutes: quizMinutes,
  closesAtMs: epochMs("Kapanış zamanı").nullable().optional(),
  sourceFileName: optionalText("Kaynak dosya adı", LIMITS.fileNameLength),
  questions: z
    .array(QuizQuestionInput, { error: "Sorular liste olmalıdır." })
    .min(LIMITS.quizQuestions.min, { error: `Sınav en az ${LIMITS.quizQuestions.min} soru içermelidir.` })
    .max(LIMITS.quizQuestions.max, { error: `Sınav en fazla ${LIMITS.quizQuestions.max} soru içerebilir.` }),
});
export const SaveQuizDraftResponse = z.object({ quizId: z.string(), questionCount: z.number() });

export const PublishQuizRequest = z.object({
  quizId: docId("Sınav"),
  durationMinutes: quizMinutes.optional(),
  closesAtMs: epochMs("Kapanış zamanı").nullable().optional(),
});
export const PublishQuizResponse = z.object({ published: z.literal(true), archivedPreviousCount: z.number() });

export const CloseQuizRequest = z.object({ quizId: docId("Sınav") });
export const CloseQuizResponse = z.object({ closed: z.literal(true) });

export const StartQuizAttemptRequest = z.object({ quizId: docId("Sınav") });
export const StartQuizAttemptResponse = z.object({ deadlineMs: z.number(), resumed: z.boolean() });

export const SubmitQuizAttemptRequest = z.object({
  quizId: docId("Sınav"),
  responses: z.record(z.string().max(LIMITS.idLength), z.array(z.string().max(LIMITS.textAnswerLength.max)).max(20), {
    error: "Yanıtlar geçersiz.",
  }),
  tabSwitchCount: z.number().int().min(0).max(LIMITS.tabSwitchCountMax).optional().default(0),
});

export const GradedItemSchema = z.object({
  questionId: z.string(),
  orderIndex: z.number(),
  caseContent: z.string(),
  imageUrl: z.string(),
  questionText: z.string(),
  questionType: z.enum(QUESTION_TYPES),
  isCorrect: z.boolean(),
  userResponse: z.array(z.string()),
  correctAnswers: z.array(z.string()),
  feedbackText: z.string(),
});
export const SubmitQuizAttemptResponse = z.object({
  score: z.number(),
  correctCount: z.number(),
  totalQuestions: z.number(),
  gradedReport: z.array(GradedItemSchema),
  lateSubmission: z.boolean(),
});

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
  startLectureSession: { request: StartLectureSessionRequest, response: StartLectureSessionResponse },
  endLectureSession: { request: EndLectureSessionRequest, response: EndLectureSessionResponse },
  getProjectorCode: { request: GetProjectorCodeRequest, response: GetProjectorCodeResponse },
  verifyRealTimeAttendance: { request: VerifyRealTimeAttendanceRequest, response: VerifyRealTimeAttendanceResponse },
  markAttendanceExcused: { request: MarkAttendanceExcusedRequest, response: MarkAttendanceExcusedResponse },
  saveQuizDraft: { request: SaveQuizDraftRequest, response: SaveQuizDraftResponse },
  publishQuiz: { request: PublishQuizRequest, response: PublishQuizResponse },
  closeQuiz: { request: CloseQuizRequest, response: CloseQuizResponse },
  startQuizAttempt: { request: StartQuizAttemptRequest, response: StartQuizAttemptResponse },
  submitQuizAttempt: { request: SubmitQuizAttemptRequest, response: SubmitQuizAttemptResponse },
} as const;

export type CallableName = keyof typeof CALLABLES;
/** İstemcinin gönderdiği (dönüşüm ÖNCESİ) istek tipi. */
export type CallableRequestInput<N extends CallableName> = z.input<(typeof CALLABLES)[N]["request"]>;
/** Sunucunun doğrulama SONRASI gördüğü istek tipi. */
export type CallableRequestData<N extends CallableName> = z.output<(typeof CALLABLES)[N]["request"]>;
export type CallableResponse<N extends CallableName> = z.output<(typeof CALLABLES)[N]["response"]>;
