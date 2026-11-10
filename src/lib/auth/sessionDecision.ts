import type { MemberStatus, Role } from "@shared/constants";

/** Oturumu sonlandırma nedeni → giriş ekranında gösterilir (`/login?neden=...`). */
export type SignOutReason = "askida" | "oturum-sonlandi";

export const SIGN_OUT_MESSAGES: Record<SignOutReason, string> = {
  askida: "Üyeliğiniz askıya alındı. Ayrıntı için eğitim sorumlusuyla iletişime geçin.",
  "oturum-sonlandi": "Oturumunuz güvenlik nedeniyle sonlandırıldı. Lütfen yeniden giriş yapın.",
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
 * - profil yok → kayıt tamamlanmamış (`/register`),
 * - askıda → oturumu kapat,
 * - oturum, profildeki iptal zamanından (`tokensValidAfter`) önce açılmışsa → oturumu kapat
 *   (kurallar ve callable'lar bu oturumu zaten reddediyor; arayüz de kapanır),
 * - aksi halde hazır; claim önbelleği dokümandan farklıysa yenilenmesi istenir (yalnızca önbellek).
 */
export function evaluateSession(profile: ProfileSnapshot | null, token: TokenSnapshot): SessionDecision {
  if (!profile) return { kind: "needsProfile" };

  const role: Role = profile.role === "admin" ? "admin" : "user";
  const status: MemberStatus =
    profile.status === "active" || profile.status === "suspended" ? profile.status : "pending";

  if (status === "suspended") return { kind: "signOut", reason: "askida" };

  const validAfter = typeof profile.tokensValidAfter === "number" ? profile.tokensValidAfter : 0;
  if (validAfter > 0 && token.authTimeSeconds <= validAfter) return { kind: "signOut", reason: "oturum-sonlandi" };

  const refreshClaims = token.claimRole !== role || token.claimStatus !== status;
  return { kind: "ready", role, status, refreshClaims };
}
