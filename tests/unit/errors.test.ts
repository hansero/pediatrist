import { describe, expect, it } from "vitest";
import { AppError, APP_ERROR_MESSAGES, cameraErrorMessage, toAppError, toUserMessage } from "@/lib/errors";

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

describe("kamera hataları (F11.2: QR okutma)", () => {
  it("izin reddi, kamera yok ve kamera meşgul ayrı ve çözüm gösteren Türkçe mesaj; bilinmeyen hata genel mesaj", () => {
    const dom = (name: string) => new DOMException("x", name);
    expect(cameraErrorMessage(dom("NotAllowedError"))).toContain("Kamera izni verilmedi");
    expect(cameraErrorMessage(dom("NotAllowedError"))).toContain("kodu elle girin");
    expect(cameraErrorMessage(dom("NotFoundError"))).toContain("kamera bulunamadı");
    expect(cameraErrorMessage(dom("NotReadableError"))).toContain("başka bir uygulamada açık");
    expect(cameraErrorMessage(new Error("boom"))).toBe("Kamera açılamadı. Tekrar deneyin ya da kodu elle girin.");
    expect(cameraErrorMessage(undefined)).toContain("Kamera açılamadı");
  });
});

describe("Storage ve Firestore istemci hataları (F5.2)", () => {
  const firebaseError = (code: string) =>
    Object.assign(new Error("Firebase: Error (" + code + ")."), { code, name: "FirebaseError" });

  it("Storage kodları Türkçe; bilinmeyen Storage kodu teknik ayrıntı sızdırmaz", () => {
    expect(toAppError(firebaseError("storage/unauthorized"))).toMatchObject({ code: "permission-denied" });
    expect(toUserMessage(firebaseError("storage/unauthorized"))).toContain("dosya türü/boyutu");
    expect(toUserMessage(firebaseError("storage/object-not-found"))).toMatch(
      /^Dosya bulunamadı; .*Sayfayı yenileyin\.$/
    );
    expect(toAppError(firebaseError("storage/bilinmeyen")).code).toBe("internal");
  });

  it("öneksiz Firestore kodu varsayılan Türkçe metne eşlenir; Firebase olmayan hata eşlenmez", () => {
    expect(toAppError(firebaseError("permission-denied"))).toMatchObject({
      code: "permission-denied",
      message: "Bu işlem için yetkiniz yok. Gerekliyse eğitim sorumlusuna başvurun.",
    });
    expect(toAppError(Object.assign(new Error("x"), { code: "permission-denied" })).code).toBe("internal");
  });
});
