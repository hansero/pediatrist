/**
 * Ortam güvenlik ayarlarının TEK kaynağı (N8, D20, D21): Firestore `config/security` dokümanı.
 *
 * - `requireMfa`: ikinci faktörle (TOTP) açılmamış oturum veri okuyamaz / işlem yapamaz.
 * - `requireEmailVerified`: e-postası doğrulanmamış hesap veri okuyamaz / işlem yapamaz.
 *
 * Aynı doküman üç yerde okunur:
 *  - Firestore ve Storage kuralları (`securitySatisfied()`): şartları sağlamayan oturum veri OKUYAMAZ,
 *  - Cloud Functions (`guards.ts → requireActive`): şartları sağlamayan oturum işlem YAPAMAZ,
 *  - istemci (oturum bağlamı): e-posta doğrulama ekranına / MFA kurulum sayfasına yönlendirme.
 *
 * GÜVENLİ VARSAYILAN: doküman yoksa veya alan açıkça `false` değilse şart ZORUNLUDUR. Yalnızca emülatör
 * seed'i `false` yazar (Auth emülatörü TOTP desteklemiyor, D5; e-posta testleri ayrıca açar). Doküman
 * istemciye salt okunurdur; yalnızca Admin SDK / konsoldan değiştirilir.
 */
export const SECURITY_CONFIG = { collection: "config", doc: "security" } as const;

export interface SecurityConfigDoc {
  requireMfa?: unknown;
  requireEmailVerified?: unknown;
}

export interface SecurityConfig {
  requireMfa: boolean;
  requireEmailVerified: boolean;
}

export function parseSecurityConfig(data: SecurityConfigDoc | null | undefined): SecurityConfig {
  return {
    requireMfa: data?.requireMfa !== false,
    requireEmailVerified: data?.requireEmailVerified !== false,
  };
}
