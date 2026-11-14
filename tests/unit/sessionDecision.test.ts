import { describe, expect, it } from "vitest";
import { SIGN_OUT_MESSAGES, SIGN_OUT_TONES, evaluateSession, needsConsent } from "@/lib/auth/sessionDecision";

const now = 1_800_000_000;
const token = (overrides = {}) => ({ authTimeSeconds: now, claimRole: "user", claimStatus: "active", ...overrides });

describe("evaluateSession", () => {
  it("profil yoksa kayıt tamamlanmamıştır", () => {
    expect(evaluateSession(null, token())).toEqual({ kind: "needsProfile" });
  });

  it("askıdaki üyenin oturumu kapatılır — claim'de 'active' yazsa bile (doküman esastır)", () => {
    expect(evaluateSession({ role: "user", status: "suspended" }, token({ claimStatus: "active" }))).toEqual({
      kind: "signOut",
      reason: "askida",
    });
  });

  it("iptal zamanından önce açılmış oturum kapatılır, sonra açılmış oturum devam eder", () => {
    const profile = { role: "user", status: "active", tokensValidAfter: now };
    expect(evaluateSession(profile, token({ authTimeSeconds: now - 1 }))).toMatchObject({ reason: "oturum-sonlandi" });
    expect(evaluateSession(profile, token({ authTimeSeconds: now }))).toMatchObject({ reason: "oturum-sonlandi" });
    expect(evaluateSession(profile, token({ authTimeSeconds: now + 1 }))).toMatchObject({ kind: "ready" });
  });

  it("bekleyen üye hazırdır (arayüz onay ekranını gösterir); admin onaylayınca aynı akışla aktif olur", () => {
    expect(evaluateSession({ role: "user", status: "pending" }, token({ claimStatus: "pending" }))).toEqual({
      kind: "ready",
      role: "user",
      status: "pending",
      refreshClaims: false,
    });
    expect(evaluateSession({ role: "user", status: "active" }, token({ claimStatus: "pending" }))).toEqual({
      kind: "ready",
      role: "user",
      status: "active",
      refreshClaims: true,
    });
  });

  it("rol dokümandan gelir; claim'deki 'admin' dokümandaki 'user'ı ezemez", () => {
    expect(evaluateSession({ role: "user", status: "active" }, token({ claimRole: "admin" }))).toMatchObject({
      role: "user",
      refreshClaims: true,
    });
  });

  it("geçersiz rol/durum değerleri en düşük yetkiye indirgenir", () => {
    expect(evaluateSession({ role: "superadmin", status: "??" }, token())).toMatchObject({
      role: "user",
      status: "pending",
    });
  });

  it("profil hiç yoksa kayıt tamamlanır; bu oturumda görülmüş profil kaybolduysa hesap silinmiştir (F9.1)", () => {
    const token = { authTimeSeconds: 100 };
    expect(evaluateSession(null, token)).toEqual({ kind: "needsProfile" });
    expect(evaluateSession(null, token, true)).toEqual({ kind: "signOut", reason: "hesap-silindi" });
  });

  it("her oturum kapatma nedeninin Türkçe mesajı vardır", () => {
    expect(Object.keys(SIGN_OUT_MESSAGES).sort()).toEqual([
      "askida",
      "hareketsizlik",
      "hesap-silindi",
      "mfa-kuruldu",
      "oturum-sonlandi",
    ]);
    expect(Object.keys(SIGN_OUT_TONES).sort()).toEqual(Object.keys(SIGN_OUT_MESSAGES).sort());
  });
});

describe("needsConsent (F13.1: onay ve MFA sırası)", () => {
  const base = { consentVersion: "1.0", mfaRequired: true, mfaEnrolled: true };

  it("güncel sürümü onaylamış üyeden onay istenmez", () => {
    expect(needsConsent(base, "1.0")).toBe(false);
    expect(needsConsent({ ...base, mfaEnrolled: false }, "1.0")).toBe(false);
  });

  it("eski sürüm veya onaysız: MFA kuruluysa ya da zorunlu değilse onay istenir", () => {
    expect(needsConsent(base, "1.2")).toBe(true);
    expect(needsConsent({ ...base, consentVersion: null }, "1.2")).toBe(true);
    expect(needsConsent({ ...base, mfaRequired: false, mfaEnrolled: false }, "1.2")).toBe(true);
  });

  it("MFA zorunlu ve kurulmamışsa onay ertelenir (önce MFA; onay callable'ı MFA'lı oturum ister)", () => {
    expect(needsConsent({ ...base, mfaEnrolled: false }, "1.2")).toBe(false);
    expect(needsConsent({ ...base, consentVersion: null, mfaEnrolled: false }, "1.2")).toBe(false);
  });
});
