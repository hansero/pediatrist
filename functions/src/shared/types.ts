/**
 * Firestore doküman tipleri (istemci ve sunucu ortak).
 *
 * Zaman damgası tipi SDK'ya göre değişir (istemci: `firebase/firestore` Timestamp,
 * sunucu: `firebase-admin/firestore` Timestamp). Bu klasör hiçbir Firebase SDK'sına bağımlı
 * olmadığı için doküman tipleri `T` zaman damgası parametresi alır:
 *   istemci → `MemberDoc<Timestamp>` (firebase/firestore), sunucu → `MemberDoc<Timestamp>` (firebase-admin).
 *
 * Şemalar sunucunun BUGÜN yazdığı alanları yansıtır; değişiklikler ilgili adımda burada yapılır
 * (üyeler → F2.3, yoklama → F4.1, sınavlar → F5.1, materyaller → F6.1).
 */
import type {
  AuditResourceType,
  AuditSeverity,
  MaterialFileType,
  MemberStatus,
  QuestionType,
  RevealPolicy,
  Role,
} from "./constants";

/** Koleksiyon adları (tek kaynak). */
export const COLLECTIONS = {
  users: "users",
  invitations: "invitations",
  materials: "materials",
  materialProgress: "progress",
  calculatorsConfig: "calculators_config",
  attendanceSessions: "attendance_sessions",
  attendanceRecords: "records",
  attendanceLogs: "attendance_logs",
  attendanceSecrets: "attendance_secrets",
  /** `attendance_meta/live`: tek canlı ders kilidi (F4.1); istemciye kapalı. */
  attendanceMeta: "attendance_meta",
  quizzes: "quizzes",
  quizQuestionsPublic: "questions_public",
  quizAnswerKeys: "quiz_answer_keys",
  quizAnswerKeyItems: "items",
  quizQuestionArchive: "quiz_question_archive",
  quizAttempts: "quiz_attempts",
  /** `quiz_attempt_drafts/{quizId}_{uid}`: süre içinde kaydedilen yanıtlar (F5.1); istemciye kapalı. */
  quizAttemptDrafts: "quiz_attempt_drafts",
  auditLogs: "audit_logs",
  /** `rate_limits/{tür}_{uid}`: hız sınırı sayaçları (F9.2); istemciye kapalı, TTL ile temizlenir. */
  rateLimits: "rate_limits",
} as const;

// --- Üyelik -----------------------------------------------------------------

/** Firebase Auth custom claims. Yetkinin tek kaynağı `users/{uid}`'dir (D3); claim'ler önbellektir. */
export interface MemberClaims {
  role: Role;
  status: MemberStatus;
  /** Asistanlar için 1–4; uzman/öğretim üyesi için `null` (F3.5). */
  residencyYear: number | null;
}

/** `users/{uid}` */
export interface MemberDoc<T> {
  uid: string;
  title: string;
  fullName: string;
  email: string;
  /** Asistanlar için 1–4; uzman/öğretim üyesi için `null` (F3.5). */
  residencyYear: number | null;
  role: Role;
  status: MemberStatus;
  createdAt: T;
  updatedAt?: T;
  approvedBy?: string;
  updatedBy?: string;
  inviteCode?: string | null;
  /** KVKK aydınlatma metni onayı (F3.5'te zorunlu). */
  consent?: { version: string; acceptedAt: T } | null;
  /**
   * Bu zamandan (epoch SANİYE) önce açılmış oturumlar geçersizdir: askıya alma / rol düşürme
   * anında yazılır ve `auth_time` ile karşılaştırılır (D3). F2.3'te `syncUserClaims` yazar.
   */
  tokensValidAfter?: number;
}

/** `invitations/{id}` (Plan.MD §5) */
export interface InvitationDoc<T> {
  code: string;
  email: string;
  intendedRole: Role;
  residencyYear: number | null;
  invitedBy: string;
  createdAt: T;
  expiresAt: T;
  used: boolean;
  usedBy?: string;
  usedAt?: T;
  revoked?: boolean;
  revokedBy?: string;
  revokedAt?: T;
}

// --- Yoklama ----------------------------------------------------------------

export type AttendanceSessionStatus = "live" | "closed";
/** `absent`: ders kapanırken beklenen ama kaydı olmayan hekim için sunucunun yazdığı durum (D22). */
export type AttendanceStatus = "present" | "excused" | "absent";
/**
 * Sunucuda doğrulanmış yöntem: `code` = MFA'lı oturum + projektör kodu (D23).
 * `qr+webauthn` yalnızca eski kayıtlarda bulunur (F4.2'deki passkey dönemi; yeni kayıt yazılmaz).
 */
export type AttendanceMethod = "code" | "qr+webauthn" | "admin_excused" | "system_absent";

/** `attendance_sessions/{sessionId}` */
export interface AttendanceSessionDoc<T> {
  title: string;
  lecturer: string;
  /** Yalnızca eski kayıtlarda (ders kategorisi F11.3'te kaldırıldı). */
  category?: string;
  durationMinutes: number;
  status: AttendanceSessionStatus;
  startedAt: T;
  endsAt: T;
  startedBy: string;
  presentCount: number;
  excusedCount: number;
  /** Ders kapanırken yazılır (D22): beklenen ama katılmayan ve mazeret girilmemiş hekim sayısı. */
  absentCount?: number;
  /**
   * Ders başladığı anda etkin hekimlerin (rol `user`) uid listesi (F4.1). Katılım oranının paydası budur;
   * sonradan katılan/ayrılan üyeler geçmiş derslerin oranını değiştirmez.
   */
  expectedAttendees?: string[];
  expectedCount?: number;
  closedAt?: T;
  /** Kapatan admin uid'i veya süre dolumunda `"system"`. */
  closedBy?: string;
  closeReason?: "manual" | "expired";
}

/** `attendance_meta/live`: aynı anda tek canlı ders kilidi (F4.1). Canlı ders yoksa doküman yoktur. */
export interface AttendanceLiveLockDoc<T> {
  sessionId: string;
  endsAt: T;
}

/** `attendance_sessions/{sessionId}/records/{uid}` */
export interface AttendanceRecordDoc<T> {
  uid: string;
  fullName: string;
  title: string;
  residencyYear: number | null;
  /** Katılım/mazeret anı; `absent` kayıtlarda `null` (bkz. `markedAt`). */
  verifiedAt: T | null;
  markedAt?: T;
  method: AttendanceMethod;
  status: AttendanceStatus;
  excuseNote?: string;
  markedBy?: string;
}

/** `attendance_logs/{sessionId}_{uid}`: ders ve katılımcı bazlı raporlar için düz kopya. */
export interface AttendanceLogDoc<T> extends AttendanceRecordDoc<T> {
  sessionId: string;
  sessionTitle: string;
  lecturer: string;
  /** Yalnızca eski kayıtlarda (ders kategorisi F11.3'te kaldırıldı). */
  category?: string;
  sessionStartedAt: T;
}

// --- Sınav ------------------------------------------------------------------

export type QuizStatus = "draft" | "published" | "closed";
export type QuizAttemptStatus = "in_progress" | "submitted";

/** `quizzes/{quizId}` */
export interface QuizDoc<T> {
  title: string;
  status: QuizStatus;
  durationMinutes: number;
  closesAt: T | null;
  /** D7; eski dokümanlarda yoksa `after_close` sayılır. */
  revealPolicy: RevealPolicy;
  questionCount: number;
  sourceFileName: string;
  createdAt: T;
  createdBy: string;
  updatedAt?: T;
  attemptCount: number;
  publishedAt?: T;
  publishedBy?: string;
  closedAt?: T;
  /** Kapatan admin uid'i veya `"system"` (kapanış zamanı). */
  closedBy?: string;
  closeReason?: "manual" | "replaced" | "expired";
  /**
   * `after_close` karnesinin açılacağı an: kapanış anı ile kapanışta devam eden girişimlerin en geç bitişi
   * (+ teslim toleransı) arasından büyük olanı. Böylece süresi süren meslektaşa cevap sızmaz (F5.1).
   */
  revealAt?: T | null;
}

/** 1–7. alanlar: `quizzes/{quizId}/questions_public/{questionId}` */
export interface QuizQuestionPublicDoc {
  orderIndex: number;
  caseContent: string;
  /** Storage yolu (`quiz_media/...`) veya boş. */
  imageUrl: string;
  questionText: string;
  questionType: QuestionType;
  maxLength: number;
  optionsRaw: string;
  optionsArray: string[];
}

/** 8–9. alanlar (hekime kapalı): `quiz_answer_keys/{quizId}/items/{questionId}` */
export interface QuizAnswerKeyDoc {
  correctAnswers: string[];
  feedbackText: string;
}

/** `quiz_question_archive/{id}`: 9 alanın tamamı + kaynak bilgisi. */
export interface QuizArchivedQuestionDoc<T> extends QuizQuestionPublicDoc, QuizAnswerKeyDoc {
  sourceQuizId: string;
  sourceQuizTitle: string;
  archivedAt: T;
  archivedBy: string;
}

/** Girişimde saklanan soru sonucu: doğru cevap ve feedback İÇERMEZ (hekim kendi girişimini okuyabilir). */
export interface AttemptResult {
  questionId: string;
  orderIndex: number;
  isCorrect: boolean;
  userResponse: string[];
}

/**
 * Karne satırı (`submitQuizAttempt` / `getAttemptReport` yanıtı). `correctAnswers` ve `feedbackText` yalnızca
 * karne açıksa doludur (D7); değilse `null`.
 */
export interface GradedItem {
  questionId: string;
  orderIndex: number;
  caseContent: string;
  imageUrl: string;
  questionText: string;
  questionType: QuestionType;
  options: string[];
  isCorrect: boolean;
  userResponse: string[];
  correctAnswers: string[] | null;
  feedbackText: string | null;
}

/** `quiz_attempts/{quizId}_{uid}` */
export interface QuizAttemptDoc<T> {
  quizId: string;
  quizTitle: string;
  uid: string;
  doctorName: string;
  residencyYear: number | null;
  status: QuizAttemptStatus;
  revealPolicy: RevealPolicy;
  questionCount: number;
  startedAt: T;
  deadline: T;
  durationMinutes: number;
  submittedAt?: T;
  durationSeconds?: number;
  /** Süre + tolerans aşıldıktan sonra teslim edildi: süre içinde kaydedilmiş yanıtlar puanlandı. */
  lateSubmission?: boolean;
  /** Hekim teslim etmedi; zamanlayıcı süre içinde kaydedilmiş yanıtlarla teslim etti. */
  autoSubmitted?: boolean;
  score?: number;
  correctCount?: number;
  totalQuestions?: number;
  results?: AttemptResult[];
  tabSwitchCount?: number;
}

/** `quiz_attempt_drafts/{quizId}_{uid}`: istemciye kapalı; yalnızca callable'lar okur/yazar. */
export interface QuizAttemptDraftDoc<T> {
  uid: string;
  quizId: string;
  responses: Record<string, string[]>;
  updatedAt: T;
}

// --- Materyaller ------------------------------------------------------------

export type MaterialStatus = "draft" | "published";

/** `materials/{materialId}`: yalnızca callable'lar yazar (F6.1). */
/** `calculators_config/{calculatorId}`: kliniğin protokol notu (F7.4); yalnızca `updateCalculatorConfig` yazar. */
export interface CalculatorConfigDoc<T> {
  calculatorId: string;
  protocolNote: string;
  updatedBy: string;
  updatedByName: string;
  updatedAt: T;
}

export interface MaterialDoc<T> {
  title: string;
  description: string;
  /** Serbest etiketler (D25, F11.5). */
  labels: string[];
  /** Yalnızca F11.5 öncesi dokümanlarda (sabit kategori); okurken tek etiket sayılır (`materialLabelsOf`). */
  category?: string;
  targetYears: number[];
  isMandatory: boolean;
  allowDownload: boolean;
  fileType: MaterialFileType;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedByName: string;
  /** `draft`: yükleme bekleniyor (hekime görünmez); `published`: dosya sunucuda doğrulandı (F6.1). */
  status: MaterialStatus;
  createdAt: T;
  publishedAt?: T;
  updatedAt?: T;
}

/** `materials/{materialId}/progress/{uid}` (F2.1 kural şeması ile aynı alanlar). */
export interface MaterialProgressDoc<T> {
  uid: string;
  secondsSpent: number;
  lastPage: number;
  completed: boolean;
  updatedAt: T;
}

// --- Denetim kaydı ----------------------------------------------------------

/** `audit_logs/{id}`: yalnızca sunucu yazar, kimse silemez. */
export interface AuditLogDoc<T> {
  actorUid: string;
  actorEmail: string;
  action: string;
  resourceType: AuditResourceType;
  resourceId: string;
  severity: AuditSeverity;
  timestamp: T;
  /** İsteğin geldiği ağın tuzlu özeti (HMAC-SHA256, 32 onaltılık karakter); ham IP saklanmaz (F9.2). */
  ipHash?: string;
  userAgent?: string;
  /** Saklama süresi sonu; Firestore TTL politikası siler (F9.2). Eski kayıtlarda yoktur. */
  expireAt?: T;
  metadata?: Record<string, unknown>;
}
