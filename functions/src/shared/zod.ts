import { z } from "zod";

/**
 * Ortak zod yapılandırması (F2.5). Ortak şemalar `zod`'u doğrudan değil BU modülden alır; böylece hem
 * Cloud Functions hem tarayıcı aynı ayarlarla çalışır:
 *
 * - `tr` yerel ayarı: şemada açık mesajı olmayan kurallar için Türkçe varsayılan mesajlar. (Önceden yalnızca
 *   functions tarafında ayarlıydı; istemcideki ön doğrulama İngilizce varsayılan mesaj gösterebiliyordu.)
 * - `jitless`: zod nesne doğrulayıcılarını `new Function` ile derlemeye çalışmadan önce `eval` iznini
 *   yoklar. Hata yakalansa bile sıkı CSP (`'unsafe-eval'` yok) bunu `securitypolicyviolation` olarak
 *   raporlar; e2e CSP bekçisi bunu yakaladı. Yorumlayıcı yol bizim yük boyutlarımızda fark yaratmaz.
 */
z.config(z.locales.tr());
z.config({ jitless: true });

export { z };
