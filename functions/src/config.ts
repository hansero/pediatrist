import { defineBoolean, defineString } from "firebase-functions/params";

/**
 * Çalışma zamanı güvenlik parametreleri (D13).
 *
 * MFA ve e-posta doğrulama zorunlulukları burada DEĞİL: kurallar da uygulayabilsin diye tek kaynakları
 * Firestore `config/security` dokümanıdır (N8, D20, D21; `shared/security.ts`).
 *
 * Varsayılanlar GÜVENLİ taraftadır (true). Emülatörde `functions/.env.demo-pediatrist`
 * ile kapatılır. Gerçek projede deploy sırasında değer sorulursa `true` bırakılmalıdır.
 *
 * Not: `onCall({ enforceAppCheck })` yalnızca sabit boolean kabul eder; bu yüzden App Check
 * zorunluluğu `guards.ts` içinde (F1.3) bu parametre okunarak çalışma anında uygulanır.
 * Parametre değerleri yalnızca handler içinde `.value()` ile okunmalıdır (modül yüklenirken değil).
 */
export const ENFORCE_APP_CHECK = defineBoolean("ENFORCE_APP_CHECK", {
  default: true,
  description: "Callable'larda geçerli App Check token'ı zorunlu olsun mu?",
});

/**
 * WebAuthn (F4.2): Relying Party kimliği (uygulamanın alan adı, ör. `pediatrist.web.app`) ve passkey
 * törenlerinin kabul edildiği kökenler (virgülle ayrılmış tam adresler, ör. `https://pediatrist.web.app`).
 * İstemci bunları bilmez; seçenekleri sunucu üretir (tek kaynak). Tanımlı değilse cihaz işlemleri reddedilir.
 */
export const WEBAUTHN_RP_ID = defineString("WEBAUTHN_RP_ID", {
  description: "WebAuthn RP ID: uygulamanın yayınlandığı alan adı (şema ve port olmadan).",
});

export const WEBAUTHN_ORIGINS = defineString("WEBAUTHN_ORIGINS", {
  description: "WebAuthn kabul edilen kökenler, virgülle ayrılmış (ör. https://pediatrist.web.app).",
});
