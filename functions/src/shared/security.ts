/**
 * Ortam güvenlik ayarlarının TEK kaynağı (N8, D20): Firestore `config/security` dokümanı.
 *
 * Aynı doküman üç yerde okunur:
 *  - Firestore ve Storage kuralları (`mfaRequired()`): MFA'sız oturum veri OKUYAMAZ,
 *  - Cloud Functions (`guards.ts → requireActive`): MFA'sız oturum işlem YAPAMAZ,
 *  - istemci (oturum bağlamı): MFA kaydı olmayan üye kurulum sayfasına yönlendirilir.
 *
 * GÜVENLİ VARSAYILAN: doküman yoksa veya alan açıkça `false` değilse MFA ZORUNLUDUR. Yalnızca emülatör
 * seed'i `requireMfa: false` yazar (Auth emülatörü TOTP desteklemiyor, D5). Doküman istemciye salt okunurdur;
 * yalnızca Admin SDK / konsoldan değiştirilir.
 */
export const SECURITY_CONFIG = { collection: "config", doc: "security" } as const;

export interface SecurityConfigDoc {
  requireMfa?: unknown;
}

export interface SecurityConfig {
  requireMfa: boolean;
}

export function parseSecurityConfig(data: SecurityConfigDoc | null | undefined): SecurityConfig {
  return { requireMfa: data?.requireMfa !== false };
}
