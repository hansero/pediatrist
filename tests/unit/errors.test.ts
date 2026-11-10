import { describe, expect, it } from "vitest";
import { AppError, APP_ERROR_MESSAGES, toAppError, toUserMessage } from "@/lib/errors";

const firebaseError = (code: string, message: string, details?: unknown) =>
  Object.assign(new Error(message), { code, details });

describe("toAppError", () => {
  it("sunucunun Türkçe mesajını kullanıcıya iletir (yetki, doğrulama, ön koşul)", () => {
    const e = toAppError(firebaseError("functions/permission-denied", "Üyeliğiniz askıya alınmış."));
    expect(e).toBeInstanceOf(AppError);
    expect(e.code).toBe("permission-denied");
    expect(e.message).toBe("Üyeliğiniz askıya alınmış.");
    expect(toUserMessage(firebaseError("functions/invalid-argument", "Ders başlığı zorunludur."))).toBe(
      "Ders başlığı zorunludur."
    );
  });

  it("'internal' ve bilinmeyen kodlarda teknik mesajı GÖSTERMEZ", () => {
    expect(toUserMessage(firebaseError("functions/internal", "TypeError: x is undefined at handler.js:12"))).toBe(
      APP_ERROR_MESSAGES.internal
    );
    expect(toUserMessage(firebaseError("functions/data-loss", "stack trace"))).toBe(APP_ERROR_MESSAGES.internal);
  });

  it("mesajı yalnızca kod adı olan hatada Türkçe yedek metni kullanır", () => {
    expect(toUserMessage(firebaseError("functions/unauthenticated", "unauthenticated"))).toBe(
      APP_ERROR_MESSAGES.unauthenticated
    );
  });

  it("ağ hatasını 'unavailable' olarak eşler", () => {
    expect(toAppError(new TypeError("Failed to fetch")).code).toBe("unavailable");
    expect(toAppError(firebaseError("functions/unavailable", "x")).message).toBe(APP_ERROR_MESSAGES.unavailable);
  });

  it("ayrıntıları korur, AppError'ı olduğu gibi geçirir", () => {
    const details = { issues: [{ path: "title", message: "x" }] };
    expect(toAppError(firebaseError("functions/invalid-argument", "x", details)).details).toEqual(details);
    const own = new AppError("not-found", "Yok.");
    expect(toAppError(own)).toBe(own);
    expect(toUserMessage("düz metin")).toBe(APP_ERROR_MESSAGES.internal);
  });
});

describe("Firebase Auth hataları", () => {
  it("bilinen kodları Türkçe mesaja, bilinmeyenleri genel mesaja çevirir", () => {
    const authErr = (code: string) => Object.assign(new Error(`Firebase: Error (${code}).`), { code });
    expect(toAppError(authErr("auth/email-already-in-use"))).toMatchObject({ code: "already-exists" });
    expect(toUserMessage(authErr("auth/email-already-in-use"))).toContain("zaten bir hesap var");
    expect(toUserMessage(authErr("auth/weak-password"))).toContain("Şifre çok zayıf");
    expect(toUserMessage(authErr("auth/invalid-credential"))).toBe("E-posta adresi veya şifre hatalı.");
    // Bilinmeyen kodda Firebase'in teknik mesajı gösterilmez
    expect(toUserMessage(authErr("auth/internal-error"))).toBe(APP_ERROR_MESSAGES.internal);
  });
});

describe("WebAuthn (passkey) tarayıcı hataları (F4.2)", () => {
  it("kütüphane kodu ve DOMException adı Türkçe mesaja çevrilir; ilgisiz hatalar etkilenmez", () => {
    const lib = (code: string, name: string) => Object.assign(new Error("x"), { code, name });
    expect(toUserMessage(lib("ERROR_CEREMONY_ABORTED", "AbortError"))).toContain("iptal edildi");
    expect(toAppError(lib("ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED", "InvalidStateError")).code).toBe(
      "already-exists"
    );
    expect(toUserMessage(lib("ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", "NotAllowedError"))).toContain("yüz/parmak izi");
    expect(toUserMessage(new DOMException("x", "NotSupportedError"))).toContain("desteklemiyor");
    // Adı benzeyen ama WebAuthn olmayan sıradan hata genel mesaja düşer.
    expect(toAppError(Object.assign(new Error("x"), { name: "NotAllowedError" })).code).toBe("internal");
  });
});
