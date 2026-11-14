# Staging Kurulum Kontrol Listesi (F10.2)

Bu liste, uygulamanın ilk kez **gerçek bir Firebase projesine** (staging) kurulması içindir. Adımların çoğu
Firebase / Google Cloud konsolunda yapılır; komutlar ve ayrıntılar [`DEPLOY.md`](../../DEPLOY.md) içindedir
(parantez içindeki bölüm numaraları oraya gider).

> Bu adımların hiçbiri henüz denenmedi. Bir adım belgede yazdığı gibi çalışmazsa "Notlar" sütununa yazın;
> `DEPLOY.md` ona göre düzeltilmelidir.

Kurulumu yapan: ……………………… Tarih: ……………… Proje kimliği: ………………………

## A. Proje ve hizmetler

| #   | Adım                                                                                                             | Nasıl doğrulanır                                               | ☐   | Notlar |
| --- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --- | ------ |
| A1  | Yeni Firebase projesi, Blaze planı                                                                               | Konsolda plan "Blaze" görünür                                  | ☐   |        |
| A2  | Bütçe ve %50 / %90 / %100 e-posta uyarıları (4.3)                                                                | Faturalandırma › Bütçeler listesinde                           | ☐   |        |
| A3  | Firestore veritabanı; konum `eur3` veya `europe-west1` (**sonradan değiştirilemez**)                             | Firestore › veritabanı ayrıntısında konum                      | ☐   |        |
| A4  | Authentication: Identity Platform'a yükseltildi; yalnızca E-posta/Şifre açık                                     | Oturum açma yöntemleri listesi                                 | ☐   |        |
| A5  | Şifre politikası: en az 10 karakter, karışık karakter zorunlu                                                    | Zayıf şifreyle kayıt reddedilir                                | ☐   |        |
| A6  | TOTP ikinci faktörü açıldı (1.1, Admin SDK ile)                                                                  | UAT A4 senaryosu geçer                                         | ☐   |        |
| A7  | E-posta şablonları (doğrulama, şifre sıfırlama) Türkçe; gönderen adı kurumsal                                    | Gelen e-postalar Türkçe ve doğru gönderenle                    | ☐   |        |
| A8  | App Check: web uygulaması reCAPTCHA Enterprise ile kayıtlı; Firestore ve Storage'da zorlama açık                 | App Check › API'ler sekmesinde "Zorunlu"                       | ☐   |        |
| A9  | Web API anahtarına HTTP yönlendiren kısıtlaması (yalnızca uygulamanın alan adı)                                  | Başka kökenden anahtarla istek reddedilir                      | ☐   |        |
| A10 | Storage varsayılan kovası; kuralların Firestore'a erişim izni onaylandı                                          | Kural dağıtımı uyarısız biter; materyal okunur                 | ☐   |        |
| A11 | Storage CORS: uygulama kökeni için `GET` (1.1; şablon `storage-cors.example.json`)                               | Hekim hesabıyla PDF materyal açılır                            | ☐   |        |
| A12 | Kovada geçici silme (soft delete) veya nesne sürümleme açık (5)                                                  | Kova ayarlarında görünür                                       | ☐   |        |

## B. Yapılandırma

| #   | Adım                                                                                                                 | Nasıl doğrulanır                                                    | ☐   | Notlar |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --- | ------ |
| B1  | `.env.local`: Firebase web yapılandırması ve reCAPTCHA Enterprise site anahtarı (1.2)                                | Uygulama açılır; "yapılandırılmamış" sayfası çıkmaz                 | ☐   |        |
| B2  | `.env.local`: KVKK veri sorumlusu adı ve başvuru adresi                                                              | `/kvkk` sayfasında kurum adı ve adres görünür; kayıt formu açık     | ☐   |        |
| B3  | `NEXT_PUBLIC_USE_EMULATORS=false` | Hesap güvenliği sayfasında "Yerel test ortamı" notu yok; "Kurulumu başlat" düğmesi var | ☐   |        |
| B4  | Secret: `AUDIT_IP_SALT` (en az 16 rastgele karakter) (2)                                                             | Denetim kayıtları › Ayrıntı'da "ağ kimliği" görünür                 | ☐   |        |
| B5  | Parametre: `AUDIT_RETENTION_DAYS` kurum politikasına göre (varsayılan 730) (2)                                       | Yeni bir denetim kaydının `expireAt` alanı beklenen tarihte         | ☐   |        |
| B6  | Parametre: `ENFORCE_APP_CHECK=true`                                                                                  | Tarayıcı dışından (ör. curl) yapılan callable isteği reddedilir     | ☐   |        |
| B7  | Yoklama cihazı (passkey) kaldırıldı (D23). Özellik açıkken kurulmuş projede `npx tsx scripts/remove-attendance-device-data.ts --project <id> --yes`; `functions/.env.<id>` içindeki `WEBAUTHN_*` satırları silinir | Kuru çalışma 0 / 0 gösterir; `npm run verify:staging` B7 uyarısı vermez | ☐   |        |
| B8  | `config/security` dokümanı **oluşturulmadı** (ya da iki alan da `true`)                                              | Firestore'da doküman yok; ikinci faktörsüz oturum veri okuyamaz     | ☐   |        |

## C. Dağıtım (1.3)

| #   | Adım                                                                       | Nasıl doğrulanır                                              | ☐   | Notlar |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------- | --- | ------ |
| C1  | Doğrulama komutları ve CI yeşil                                            | Son commit'in CI çalışması başarılı                           | ☐   |        |
| C2  | Kurallar ve indeksler dağıtıldı                                            | Firestore › İndeksler: hepsi "Etkin"                          | ☐   |        |
| C3  | TTL politikaları etkin: `audit_logs.expireAt`, `rate_limits.expireAt` (3)  | Firestore › TTL sekmesi                                       | ☐   |        |
| C4  | Cloud Functions dağıtıldı (`europe-west1`)                                 | Functions listesinde hepsi sağlıklı; zamanlanmış işler kayıtlı | ☐   |        |
| C5  | Arayüz dağıtıldı                                                           | Uygulama alan adında açılır; tarayıcı konsolunda CSP ihlali yok (özellikle `www.google.com/recaptcha`; App Check token alınabiliyor, F13.1) | ☐   |        |

## D. İlk eğitim sorumlusu ve kısa kontrol (1.4, 1.5)

| #   | Adım                                                                                     | Nasıl doğrulanır                                       | ☐   | Notlar |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ | --- | ------ |
| D1  | İlk admin: kayıt › e-posta doğrulama › konsolda `role: "admin"`, `status: "active"`      | Sayfa kendiliğinden panele geçer                       | ☐   |        |
| D2  | İlk admin iki aşamalı doğrulamayı kurdu ve kodla yeniden girdi                           | Yönetim paneli açılır                                  | ☐   |        |
| D3  | Kısa kontrol listesi (1.5): giriş, denetim kayıtları, PDF, yoklama, sınav                | Beş maddenin hepsi geçer                               | ☐   |        |

## E. Operasyon

| #   | Adım                                                                                  | Nasıl doğrulanır                                                    | ☐   | Notlar |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --- | ------ |
| E1  | Kritik olay uyarısı (`jsonPayload.audit="CRITICAL"`) ve bildirim kanalı (4.1)         | Test üyesi silinir; birkaç dakikada e-posta gelir                   | ☐   |        |
| E2  | Hata oranı uyarısı (4.2)                                                              | Uyarı politikası listede etkin                                      | ☐   |        |
| E3  | Firestore PITR açık (5)                                                               | Veritabanı ayrıntısında "zamanda geri dönüş: etkin"                 | ☐   |        |
| E4  | Zamanlanmış Firestore yedeği (5)                                                      | Yedek zamanlaması listede; ilk yedek oluşur                         | ☐   |        |
| E5  | Geri yükleme tatbikatı: bir yedek geçici bir veritabanına geri yüklendi (5)           | Geçici veritabanında üye ve yoklama kayıtları okunur                | ☐   |        |
| E6  | "Aynı ağ" işareti: hastane ağından ve mobil veriden birer yoklama (7)                 | Denetim kayıtlarında biri `true`, diğeri `false`                    | ☐   |        |
| E7  | Hız sınırı: bir dakikada 11 hatalı yoklama kodu (6)                                   | 11. deneme "Çok fazla deneme yapıldı" der; denetim kaydı düşer      | ☐   |        |

## F. Hukuk ve kurum kararları

| #   | Karar                                                                                                                       | Kim verir                    | ☐   | Notlar |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | --- | ------ |
| F1  | KVKK aydınlatma metni (`functions/src/shared/consent.ts`) onaylandı; ardından `KVKK_NOTICE_APPROVED = true` yapılıp dağıtıldı | KVKK sorumlusu / hukuk birimi | ☐   |        |
| F2  | Yurt dışı aktarım dayanağı (metnin "Aktarım" bölümü) netleştirildi                                                          | KVKK sorumlusu / hukuk birimi | ☐   |        |
| F3  | Saklama süreleri: denetim kayıtları (B5) ve eğitim kayıtları; metindeki "Saklama süresi" bölümüyle tutarlı                  | Kurum                         | ☐   |        |
| F4  | Üye silme talebinin kimden, nasıl alınacağı ve kimin uygulayacağı                                                           | Kurum                         | ☐   |        |
| F5  | Yedeklerin ve `auth:export` dosyalarının nerede, kimin erişimiyle saklanacağı                                               | Kurum / bilgi işlem           | ☐   |        |

## G. Kabul

Kullanıcı kabul testi senaryoları: [`UAT_SCENARIOS.md`](UAT_SCENARIOS.md). Staging, A–E bölümleri tamamlanıp UAT'de
engelleyici hata kalmadığında canlıya alınmaya hazırdır. Canlı ortam için bu listenin tamamı yeni projede
yeniden uygulanır.
