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
  "failed-precondition": "Bu işlem şu anda yapılamıyor.",
  "permission-denied": "Bu işlem için yetkiniz yok.",
  unauthenticated: "Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.",
  "not-found": "İstenen kayıt bulunamadı.",
  "already-exists": "Bu kayıt zaten mevcut.",
  "deadline-exceeded": "Süre doldu. Lütfen tekrar deneyin.",
  "resource-exhausted": "Çok fazla deneme yapıldı. Bir süre sonra tekrar deneyin.",
  unavailable: "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
  "not-configured": "Sunucu bağlantısı yapılandırılmamış.",
  "bad-response": "Sunucudan beklenmeyen bir yanıt alındı. Lütfen sayfayı yenileyin.",
  internal: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
};

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
  // fetch / ağ hataları (çevrimdışı, CORS, DNS)
  if (err instanceof TypeError || e?.name === "NetworkError") {
    return new AppError("unavailable", DEFAULT_ERROR_MESSAGES.unavailable);
  }
  return new AppError("internal", DEFAULT_ERROR_MESSAGES.internal);
}

/** Kullanıcıya gösterilecek Türkçe metin. */
export function toUserMessage(err: unknown): string {
  return toAppError(err).message;
}

export { DEFAULT_ERROR_MESSAGES as APP_ERROR_MESSAGES };
