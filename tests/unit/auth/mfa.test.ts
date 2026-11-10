import { beforeEach, describe, expect, it, vi } from "vitest";

// Yalnızca testte: Firebase Auth SDK'sı (emülatör TOTP'yi desteklemiyor; F3.4).
const sdk = vi.hoisted(() => ({
  getMultiFactorResolver: vi.fn(),
  multiFactor: vi.fn(),
  assertionForSignIn: vi.fn((uid: string, code: string) => ({ kind: "signIn", uid, code })),
  assertionForEnrollment: vi.fn((secret: unknown, code: string) => ({ kind: "enroll", secret, code })),
  generateSecret: vi.fn(),
}));
vi.mock("firebase/auth", () => ({
  getMultiFactorResolver: sdk.getMultiFactorResolver,
  multiFactor: sdk.multiFactor,
  TotpMultiFactorGenerator: {
    FACTOR_ID: "totp",
    assertionForSignIn: sdk.assertionForSignIn,
    assertionForEnrollment: sdk.assertionForEnrollment,
    generateSecret: sdk.generateSecret,
  },
}));

const mfa = await import("@/lib/auth/mfa");
const { AppError } = await import("@/lib/errors");

beforeEach(() => vi.clearAllMocks());

describe("isMfaRequired (güvenli varsayılan)", () => {
  it("yalnızca açıkça 'false' kapatır", () => {
    expect(mfa.isMfaRequired(undefined)).toBe(true);
    expect(mfa.isMfaRequired("")).toBe(true);
    expect(mfa.isMfaRequired("true")).toBe(true);
    expect(mfa.isMfaRequired("hayir")).toBe(true);
    expect(mfa.isMfaRequired("false")).toBe(false);
    expect(mfa.isMfaRequired(" FALSE ")).toBe(false);
  });
});

describe("normalizeTotpCode", () => {
  it("boşluk/tire atılır; 6 hane değilse Türkçe invalid-argument", () => {
    expect(mfa.normalizeTotpCode("123 456")).toBe("123456");
    expect(mfa.normalizeTotpCode("123-456")).toBe("123456");
    for (const bad of ["", "12345", "1234567", "12a456"]) {
      expect(() => mfa.normalizeTotpCode(bad)).toThrow(AppError);
    }
    expect(() => mfa.normalizeTotpCode("1")).toThrow("6 haneli");
  });
});

describe("giriş ikinci adımı", () => {
  const resolver = (factorIds: string[]) => ({
    hints: factorIds.map((factorId, i) => ({ factorId, uid: `f${i}` })),
    resolveSignIn: vi.fn().mockResolvedValue({ user: { uid: "u1" } }),
  });

  it("mfaResolverFrom: yalnızca multi-factor-auth-required hatasında çözümleyici döner", () => {
    sdk.getMultiFactorResolver.mockReturnValue("resolver");
    expect(mfa.mfaResolverFrom({} as never, { code: "auth/invalid-credential" })).toBeNull();
    expect(sdk.getMultiFactorResolver).not.toHaveBeenCalled();
    expect(mfa.mfaResolverFrom({} as never, { code: "auth/multi-factor-auth-required" })).toBe("resolver");
  });

  it("kod Identity Platform'a gönderilir (istemci kendisi doğrulamaz)", async () => {
    const r = resolver(["phone", "totp"]);
    await mfa.completeTotpSignIn(r as never, "654 321");
    expect(sdk.assertionForSignIn).toHaveBeenCalledWith("f1", "654321");
    expect(r.resolveSignIn).toHaveBeenCalledWith({ kind: "signIn", uid: "f1", code: "654321" });
  });

  it("geçersiz biçimli kod sunucuya hiç gitmez", async () => {
    const r = resolver(["totp"]);
    await expect(mfa.completeTotpSignIn(r as never, "12")).rejects.toThrow("6 haneli");
    expect(r.resolveSignIn).not.toHaveBeenCalled();
  });

  it("hesapta TOTP yoksa (yalnızca SMS) açık Türkçe hata", () => {
    expect(() => mfa.totpHint(resolver(["phone"]) as never)).toThrow("Authenticator doğrulaması bulunamadı");
  });

  it("sunucunun reddi olduğu gibi iletilir (ör. yanlış kod)", async () => {
    const r = resolver(["totp"]);
    r.resolveSignIn.mockRejectedValue({ code: "auth/invalid-verification-code" });
    await expect(mfa.completeTotpSignIn(r as never, "000000")).rejects.toEqual({
      code: "auth/invalid-verification-code",
    });
  });
});

describe("kurulum", () => {
  it("anahtar 4'lü gruplanır; otpauth adresi e-posta ve 'Pediatrist' ile üretilir; kod doğrulanınca kayıt", async () => {
    const enroll = vi.fn().mockResolvedValue(undefined);
    sdk.multiFactor.mockReturnValue({ getSession: vi.fn().mockResolvedValue("session"), enroll });
    const secret = {
      secretKey: "JBSWY3DPEHPK3PXPJBSW",
      generateQrCodeUrl: vi.fn((account: string, issuer: string) => `otpauth://totp/${issuer}:${account}`),
    };
    sdk.generateSecret.mockResolvedValue(secret);
    const user = { uid: "u1", email: "dr@pediatrist.test" };

    const e = await mfa.startTotpEnrollment(user as never);
    expect(sdk.generateSecret).toHaveBeenCalledWith("session");
    expect(e.displayKey).toBe("JBSW Y3DP EHPK 3PXP JBSW");
    expect(e.otpauthUrl).toBe("otpauth://totp/Pediatrist:dr@pediatrist.test");

    await expect(mfa.finishTotpEnrollment(user as never, e, "abc")).rejects.toThrow("6 haneli");
    expect(enroll).not.toHaveBeenCalled();
    await mfa.finishTotpEnrollment(user as never, e, "123456");
    expect(enroll).toHaveBeenCalledWith({ kind: "enroll", secret, code: "123456" }, "Authenticator");
  });
});
