/**
 * İstemci hata modeli (F1.4). Bütün sunucu çağrıları hata durumunda `AppError` fırlatır;
 * kullanıcıya gösterilecek metin her zaman `toUserMessage()` ile üretilir (CLAUDE.md kural 2).
 *
 * Teknik ayrıntı, proje kimliği veya stack trace ekrana basılmaz.
 */

export type AppErrorCode =
  | "invalid-argument"
  | "failed-precondition"
  | "permission-denied"
  | "unauthenticated"
  | "not-found"
  | "already-exists"
  | "deadline-exceeded"
  | "resource-exhausted"
  | "unavailable"
  | "not-configured"
  | "bad-response"
  | "internal";

export class AppError extends Error {
  readonly code: AppErrorCode;
  /** Sunucunun gönderdiği yapılandırılmış ayrıntılar (ör. alan bazlı doğrulama sorunları). */
  readonly details?: unknown;

  constructor(code: AppErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

/** Sunucu mesajı yoksa kullanılacak Türkçe metinler. */
const DEFAULT_ERROR_MESSAGES: Record<AppErrorCode, string> = {
  "invalid-argument": "Girilen bilgiler geçersiz. Lütfen kontrol edip tekrar deneyin.",
  "failed-precondition": "Bu işlem şu anda yapılamıyor. Sayfayı yenileyip güncel durumu kontrol edin.",
  "permission-denied": "Bu işlem için yetkiniz yok. Gerekliyse eğitim sorumlusuna başvurun.",
  unauthenticated: "Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.",
  "not-found": "İstenen kayıt bulunamadı; silinmiş olabilir. Sayfayı yenileyin.",
  "already-exists": "Bu kayıt zaten mevcut. Listeyi yenileyip kontrol edin.",
  "deadline-exceeded": "Süre doldu. Lütfen tekrar deneyin.",
  "resource-exhausted": "Çok fazla deneme yapıldı. Bir süre sonra tekrar deneyin.",
  unavailable: "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
  "not-configured": "Sunucu bağlantısı yapılandırılmamış. Platform yöneticisine bildirin.",
  "bad-response": "Sunucudan beklenmeyen bir yanıt alındı. Lütfen sayfayı yenileyin.",
  internal: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
};

/** Firebase istemcisi yokken (yapılandırma eksik) tek tip hata; metin tek kaynaktan (F8.1). */
export const notConfiguredError = () => new AppError("not-configured", DEFAULT_ERROR_MESSAGES["not-configured"]);
export const NOT_CONFIGURED_MESSAGE = DEFAULT_ERROR_MESSAGES["not-configured"];

/** Sunucu mesajı kullanıcıya gösterilebilecek kodlar (sunucu bu kodlarda Türkçe ve teknik olmayan mesaj yazar). */
const SERVER_MESSAGE_CODES = new Set<AppErrorCode>([
  "invalid-argument",
  "failed-precondition",
  "permission-denied",
  "unauthenticated",
  "not-found",
  "already-exists",
  "deadline-exceeded",
  "resource-exhausted",
]);

/** Firebase Functions hata kodu (ör. "functions/permission-denied") → AppErrorCode. */
function codeFromFirebase(raw: string): AppErrorCode {
  const code = raw.replace(/^functions\//, "");
  switch (code) {
    case "invalid-argument":
    case "failed-precondition":
    case "permission-denied":
    case "unauthenticated":
    case "not-found":
    case "already-exists":
    case "deadline-exceeded":
    case "resource-exhausted":
    case "unavailable":
      return code;
    case "out-of-range":
      return "invalid-argument";
    case "aborted":
    case "cancelled":
      return "unavailable";
    default:
      return "internal";
  }
}

/** Firebase Auth hata kodları → Türkçe (kayıt, giriş, şifre sıfırlama, TOTP; F2.3, F3.4). */
const AUTH_ERRORS: Record<string, [AppErrorCode, string]> = {
  "auth/email-already-in-use": [
    "already-exists",
    "Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin veya şifrenizi sıfırlayın.",
  ],
  "auth/invalid-email": ["invalid-argument", "E-posta adresi geçersiz."],
  "auth/weak-password": [
    "invalid-argument",
    "Şifre çok zayıf. En az 8 karakterli, tahmin edilmesi zor bir şifre seçin.",
  ],
  "auth/password-does-not-meet-requirements": [
    "invalid-argument",
    "Şifre güvenlik kurallarını karşılamıyor. Daha uzun ve karışık bir şifre seçin.",
  ],
  "auth/invalid-credential": ["unauthenticated", "E-posta adresi veya şifre hatalı."],
  "auth/wrong-password": ["unauthenticated", "E-posta adresi veya şifre hatalı."],
  "auth/user-not-found": ["unauthenticated", "E-posta adresi veya şifre hatalı."],
  "auth/user-disabled": ["permission-denied", "Bu hesap devre dışı bırakılmış. Eğitim sorumlusuyla iletişime geçin."],
  "auth/too-many-requests": ["resource-exhausted", "Çok fazla deneme yapıldı. Bir süre sonra tekrar deneyin."],
  "auth/network-request-failed": [
    "unavailable",
    "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
  ],
  "auth/missing-email": ["invalid-argument", "E-posta adresinizi girin."],
  "auth/missing-password": ["invalid-argument", "Şifrenizi girin."],
  // İki aşamalı doğrulama (TOTP, F3.4)
  "auth/invalid-verification-code": [
    "invalid-argument",
    "Doğrulama kodu hatalı veya süresi geçmiş. Uygulamadaki güncel kodu girin.",
  ],
  "auth/missing-code": ["invalid-argument", "6 haneli doğrulama kodunu girin."],
  "auth/code-expired": ["deadline-exceeded", "Doğrulama kodunun süresi doldu. Uygulamadaki güncel kodu girin."],
  "auth/invalid-multi-factor-session": [
    "deadline-exceeded",
    "Doğrulama süresi doldu. Lütfen e-posta ve şifrenizle yeniden giriş yapın.",
  ],
  "auth/missing-multi-factor-session": [
    "deadline-exceeded",
    "Doğrulama süresi doldu. Lütfen e-posta ve şifrenizle yeniden giriş yapın.",
  ],
  "auth/requires-recent-login": [
    "unauthenticated",
    "Güvenliğiniz için bu işlemden önce yeniden giriş yapmanız gerekiyor.",
  ],
  "auth/unverified-email": [
    "failed-precondition",
    "İki aşamalı doğrulamayı kurmadan önce e-posta adresinizi doğrulamanız gerekiyor.",
  ],
  "auth/second-factor-already-in-use": ["already-exists", "Bu doğrulama yöntemi hesabınızda zaten kayıtlı."],
  "auth/maximum-second-factor-count-exceeded": [
    "resource-exhausted",
    "Hesabınızda kayıtlı doğrulama yöntemi sayısı sınıra ulaştı.",
  ],
  "auth/unsupported-first-factor": ["failed-precondition", "Bu giriş yöntemi iki aşamalı doğrulamayla kullanılamıyor."],
  "auth/multi-factor-info-not-found": ["not-found", "Doğrulama yöntemi bulunamadı. Sayfayı yenileyip tekrar deneyin."],
  "auth/expired-action-code": ["deadline-exceeded", "Bağlantının süresi dolmuş. Yeni bir bağlantı isteyin."],
  "auth/invalid-action-code": [
    "invalid-argument",
    "Bağlantı geçersiz veya daha önce kullanılmış. Yeni bir bağlantı isteyin.",
  ],
};

function fromAuthError(code: string): AppError {
  const known = AUTH_ERRORS[code];
  return known ? new AppError(known[0], known[1]) : new AppError("internal", DEFAULT_ERROR_MESSAGES.internal);
}

/** Storage hataları → Türkçe (F5.2: sınav görseli yükleme). */
const STORAGE_ERRORS: Record<string, [AppErrorCode, string]> = {
  "storage/unauthorized": ["permission-denied", "Bu dosya için yetkiniz yok ya da dosya türü/boyutu kabul edilmiyor."],
  "storage/unauthenticated": ["unauthenticated", DEFAULT_ERROR_MESSAGES.unauthenticated],
  "storage/object-not-found": ["not-found", "Dosya bulunamadı; silinmiş olabilir. Sayfayı yenileyin."],
  "storage/quota-exceeded": ["resource-exhausted", "Depolama kotası doldu. Platform yöneticisine bildirin."],
  "storage/retry-limit-exceeded": ["unavailable", DEFAULT_ERROR_MESSAGES.unavailable],
  "storage/canceled": [
    "failed-precondition",
    "Yükleme iptal edildi. Dosyayı yeniden seçerek tekrar yükleyebilirsiniz.",
  ],
};

/** Firestore istemci hata kodları önek taşımaz ("permission-denied" gibi); ortak kodlar varsayılan metne eşlenir. */
const FIRESTORE_CODES = new Set<AppErrorCode>([
  "invalid-argument",
  "failed-precondition",
  "permission-denied",
  "unauthenticated",
  "not-found",
  "already-exists",
  "deadline-exceeded",
  "resource-exhausted",
  "unavailable",
]);

/** Herhangi bir hatayı `AppError`'a çevirir. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const e = err as { code?: unknown; message?: unknown; details?: unknown; name?: unknown };

  if (typeof e?.code === "string" && e.code.startsWith("functions/")) {
    const code = codeFromFirebase(e.code);
    const serverMessage = typeof e.message === "string" ? e.message.trim() : "";
    const usable = SERVER_MESSAGE_CODES.has(code) && serverMessage && serverMessage.toLowerCase() !== code;
    return new AppError(code, usable ? serverMessage : DEFAULT_ERROR_MESSAGES[code], e.details);
  }
  if (typeof e?.code === "string" && e.code.startsWith("auth/")) {
    return fromAuthError(e.code);
  }
  if (typeof e?.code === "string" && e.code.startsWith("storage/")) {
    const known = STORAGE_ERRORS[e.code];
    return known ? new AppError(known[0], known[1]) : new AppError("internal", DEFAULT_ERROR_MESSAGES.internal);
  }
  if (typeof e?.code === "string" && FIRESTORE_CODES.has(e.code as AppErrorCode) && e.name === "FirebaseError") {
    return new AppError(e.code as AppErrorCode, DEFAULT_ERROR_MESSAGES[e.code as AppErrorCode]);
  }
  // fetch / ağ hataları (çevrimdışı, CORS, DNS)
  if (err instanceof TypeError || e?.name === "NetworkError") {
    return new AppError("unavailable", DEFAULT_ERROR_MESSAGES.unavailable);
  }
  if (err instanceof Error && err.message === "not-configured") {
    return new AppError("not-configured", DEFAULT_ERROR_MESSAGES["not-configured"]);
  }
  return new AppError("internal", DEFAULT_ERROR_MESSAGES.internal);
}

/** Kullanıcıya gösterilecek Türkçe metin. */
export function toUserMessage(err: unknown): string {
  return toAppError(err).message;
}

/**
 * Kamera (`getUserMedia`) hataları → Türkçe (F11.2: yoklamada QR okutma). Yalnızca kamera açılırken yakalanan
 * hatalar için çağrılır; aynı adlı DOM hataları başka API'lerde farklı anlam taşıdığından `toAppError`'a eklenmedi.
 */
const CAMERA_ERRORS: Record<string, string> = {
  NotAllowedError: "Kamera izni verilmedi. Tarayıcı ayarlarından kamera izni verin ya da kodu elle girin.",
  SecurityError: "Kamera izni verilmedi. Tarayıcı ayarlarından kamera izni verin ya da kodu elle girin.",
  NotFoundError: "Bu cihazda kamera bulunamadı. Kodu elle girin.",
  OverconstrainedError: "Bu cihazda kamera bulunamadı. Kodu elle girin.",
  NotReadableError: "Kamera başka bir uygulamada açık. O uygulamayı kapatıp tekrar deneyin ya da kodu elle girin.",
  AbortError: "Kamera açılamadı. Tekrar deneyin ya da kodu elle girin.",
};

export const CAMERA_UNSUPPORTED_MESSAGE = "Bu tarayıcı kamerayı açamıyor; kodu elle girin.";

export function cameraErrorMessage(err: unknown): string {
  const name = (err as { name?: unknown })?.name;
  return (typeof name === "string" && CAMERA_ERRORS[name]) || "Kamera açılamadı. Tekrar deneyin ya da kodu elle girin.";
}

export { DEFAULT_ERROR_MESSAGES as APP_ERROR_MESSAGES };
