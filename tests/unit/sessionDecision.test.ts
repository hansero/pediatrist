import { describe, expect, it } from "vitest";
import { SIGN_OUT_MESSAGES, evaluateSession } from "@/lib/auth/sessionDecision";

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

  it("her oturum kapatma nedeninin Türkçe mesajı vardır", () => {
    expect(Object.keys(SIGN_OUT_MESSAGES).sort()).toEqual(["askida", "hareketsizlik", "oturum-sonlandi"]);
  });
});
