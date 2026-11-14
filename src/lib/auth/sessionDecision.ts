import type { MemberStatus, Role } from "@shared/constants";

/** Oturumu sonlandırma nedeni → giriş ekranında gösterilir (`/login?neden=...`). */
export type SignOutReason = "askida" | "oturum-sonlandi" | "hareketsizlik" | "mfa-kuruldu" | "hesap-silindi";

export const SIGN_OUT_MESSAGES: Record<SignOutReason, string> = {
  askida: "Üyeliğiniz askıya alındı. Ayrıntı için eğitim sorumlusuyla iletişime geçin.",
  "oturum-sonlandi": "Oturumunuz güvenlik nedeniyle sonlandırıldı. Lütfen yeniden giriş yapın.",
  hareketsizlik: "Uzun süre işlem yapılmadığı için oturumunuz kapatıldı. Lütfen yeniden giriş yapın.",
  "mfa-kuruldu": "İki aşamalı doğrulama etkinleştirildi. Lütfen Authenticator kodunuzla yeniden giriş yapın.",
  "hesap-silindi": "Hesabınız silindi. Sorunuz varsa eğitim sorumlusuyla iletişime geçin.",
};

/** Giriş ekranındaki bildirimin tonu: olumlu sonuçlar `success`, diğerleri `warning`. */
export const SIGN_OUT_TONES: Record<SignOutReason, "success" | "warning"> = {
  askida: "warning",
  "oturum-sonlandi": "warning",
  hareketsizlik: "warning",
  "mfa-kuruldu": "success",
  "hesap-silindi": "warning",
};

export interface ProfileSnapshot {
  role?: unknown;
  status?: unknown;
  tokensValidAfter?: unknown;
}

export interface TokenSnapshot {
  /** Oturum açma anı (epoch saniye). */
  authTimeSeconds: number;
  claimRole?: unknown;
  claimStatus?: unknown;
}

export type SessionDecision =
  | { kind: "needsProfile" }
  | { kind: "signOut"; reason: SignOutReason }
  | { kind: "ready"; role: Role; status: MemberStatus; refreshClaims: boolean };

/**
 * Oturumun ne yapacağına karar verir (saf fonksiyon; F2.4). Yetkinin kaynağı dokümandır (D3):
 * - profil yok → kayıt tamamlanmamış (`/register`); bu oturumda profil VARDI ve kaybolduysa hesap silinmiştir
 *   (F9.1) → oturumu kapat (silinen üye kayıt formuna yönlendirilmez),
 * - askıda → oturumu kapat,
 * - oturum, profildeki iptal zamanından (`tokensValidAfter`) önce açılmışsa → oturumu kapat
 *   (kurallar ve callable'lar bu oturumu zaten reddediyor; arayüz de kapanır),
 * - aksi halde hazır; claim önbelleği dokümandan farklıysa yenilenmesi istenir (yalnızca önbellek).
 */
export function evaluateSession(
  profile: ProfileSnapshot | null,
  token: TokenSnapshot,
  hadProfile = false
): SessionDecision {
  if (!profile) return hadProfile ? { kind: "signOut", reason: "hesap-silindi" } : { kind: "needsProfile" };

  const role: Role = profile.role === "admin" ? "admin" : "user";
  const status: MemberStatus =
    profile.status === "active" || profile.status === "suspended" ? profile.status : "pending";

  if (status === "suspended") return { kind: "signOut", reason: "askida" };

  const validAfter = typeof profile.tokensValidAfter === "number" ? profile.tokensValidAfter : 0;
  if (validAfter > 0 && token.authTimeSeconds <= validAfter) return { kind: "signOut", reason: "oturum-sonlandi" };

  const refreshClaims = token.claimRole !== role || token.claimStatus !== status;
  return { kind: "ready", role, status, refreshClaims };
}

/**
 * Aydınlatma metni onay ekranı (F9.1) gösterilmeli mi?
 *
 * Onay (`acceptConsent`) sunucuda etkin üye bekçisinden geçer; MFA zorunluysa ikinci faktörle açılmış oturum
 * ister (`guards.ts`). MFA zorunlu olup henüz kurulmamışsa üye yalnızca hesap güvenliği sayfasına yönlendirilir
 * (`(protected)/layout.tsx`, aynı koşul). O sayfada onay ekranı gösterilirse üye ne onaylayabilir ne de MFA
 * kurabilir: çıkışı olmayan kilitlenme (F13.1). Bu yüzden onay, MFA kurulup ikinci faktörle yeniden giriş
 * yapıldıktan SONRA istenir. Sunucu bekçisi gevşetilmez; MFA kurulmadan içerik sayfaları zaten açılmaz.
 */
export function needsConsent(
  session: { consentVersion: string | null; mfaRequired: boolean; mfaEnrolled: boolean },
  currentVersion: string
): boolean {
  if (session.consentVersion === currentVersion) return false;
  return !(session.mfaRequired && !session.mfaEnrolled);
}
