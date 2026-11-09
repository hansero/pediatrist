import { defineBoolean } from "firebase-functions/params";

/**
 * Çalışma zamanı güvenlik parametreleri (D5, D13).
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

export const REQUIRE_MFA = defineBoolean("REQUIRE_MFA", {
  default: true,
  description: "Aktif üyeler için ikinci faktör (TOTP) ile oturum açma zorunlu olsun mu?",
});

export const REQUIRE_EMAIL_VERIFIED = defineBoolean("REQUIRE_EMAIL_VERIFIED", {
  default: true,
  description: "Aktif üyeler için doğrulanmış e-posta zorunlu olsun mu?",
});
