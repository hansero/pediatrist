# Pediatrist — Dağıtım ve Operasyon

Bu belge canlı (ve staging) ortamın kurulması ve işletilmesi içindir. Yerel geliştirme için `README.md`'ye bakın.

> **Durum:** Bu belgedeki adımlar kod tarafında hazırdır ve emülatörde test edilmiştir; ancak **gerçek bir
> Firebase projesinde henüz denenmemiştir**. Konsol adımları ve `gcloud` / `gsutil` / Admin SDK komutları
> yazıldığı günkü bilgiye dayanır: ilk staging kurulumunda resmî Firebase belgeleriyle karşılaştırın ve her
> bölümün sonundaki "Doğrulama" adımını uygulayın (REVISION_PLAN F10.2).

## 1. İlk kurulum ve dağıtım

### 1.1 Proje kurulumu (bir kez, Firebase / Google Cloud konsolunda)

1. **Proje ve plan:** yeni Firebase projesi, Blaze (kullandıkça öde) planı. Bütçe uyarısını hemen kurun (bölüm 4.3).
2. **Firestore:** veritabanını oluştururken konumu seçin: `eur3` veya `europe-west1` (KVKK ve gecikme;
   REVISION_PLAN D10). **Konum sonradan değiştirilemez.**
3. **Authentication:**
   - "Identity Platform'a yükselt" (TOTP ve gelişmiş şifre politikası için gerekir).
   - Oturum açma yöntemi: yalnızca E-posta/Şifre.
   - Şifre politikası: en az 10 karakter, karışık karakter zorunlu.
   - E-posta şablonları (doğrulama, şifre sıfırlama): Türkçe ve kurumsal gönderen adı.
   - **TOTP (Authenticator) ikinci faktörü** konsoldan değil Admin SDK / REST ile açılır. Örnek (bir kez, proje
     sahibinin kimliğiyle çalıştırılır):

     ```js
     import { initializeApp } from "firebase-admin/app";
     import { getAuth } from "firebase-admin/auth";
     initializeApp();
     await getAuth()
       .projectConfigManager()
       .updateProjectConfig({
         multiFactorConfig: {
           providerConfigs: [{ state: "ENABLED", totpProviderConfig: { adjacentIntervals: 1 } }],
         },
       });
     ```

4. **App Check:** web uygulamasını reCAPTCHA Enterprise sağlayıcısıyla kaydedin; Firestore ve Storage için
   zorlamayı açın. (Cloud Functions tarafında zorlama `ENFORCE_APP_CHECK` parametresiyledir; bölüm 2.)
5. **Web API anahtarı:** Google Cloud konsolu › Kimlik bilgileri › anahtara HTTP yönlendiren (referrer)
   kısıtlaması ekleyin (yalnızca uygulamanın alan adı).
6. **Storage:** varsayılan kovayı oluşturun. Storage kuralları üyeliği Firestore'dan okur; ilk kural
   dağıtımında CLI'nin sorduğu "Storage'ın Firestore'a erişim izni"ni onaylayın.
7. **Storage CORS** (PDF görüntüleyici dosyayı tarayıcıdan `fetch` ile okur; bu olmadan PDF açılmaz):

   ```json
   [{ "origin": ["https://<uygulama-alan-adı>"], "method": ["GET"], "maxAgeSeconds": 3600 }]
   ```

   ```bash
   gsutil cors set cors.json gs://<kova-adı>
   ```

### 1.2 Ortam değişkenleri

- **İstemci (derleme zamanı):** `.env.example` dosyasını `.env.local` olarak kopyalayıp doldurun (Firebase web
  yapılandırması, reCAPTCHA Enterprise site anahtarı, KVKK veri sorumlusu adı ve başvuru adresi).
  `.env.local` git'e girmez. Zorunlu Firebase değerlerinden biri eksikse uygulama hiçbir sayfayı açmaz ve
  eksik değişkenlerin adlarını gösteren bir hata sayfası çıkar. KVKK bilgileri boşsa kayıt formu başvuru almaz.
- **Sunucu:** bölüm 2'deki gizli değer ve parametreler.
- **`config/security` dokümanını OLUŞTURMAYIN.** Doküman yokken iki aşamalı doğrulama ve e-posta doğrulaması
  zorunludur (güvenli varsayılan). Bu dokümana `false` yalnızca emülatör test verisi yazar; gerçek projede
  `false` görülmesi bir güvenlik olayıdır.

### 1.3 Dağıtım sırası

Önce bütün doğrulama komutları yeşil olmalı (`README.md` › Doğrulama komutları; CI aynı komutları çalıştırır).

```bash
node scripts/firebase.mjs use <proje-kimliği>
```

```bash
node scripts/firebase.mjs functions:secrets:set AUDIT_IP_SALT
```

```bash
npm run deploy:rules
```

```bash
npm run deploy:functions
```

```bash
node scripts/firebase.mjs deploy --only hosting
```

Sıranın nedeni: önce kurallar ve indeksler (yeni istemci eski kurallarla karşılaşmasın, sorgular indeks
bulsun), sonra Cloud Functions (istemcinin çağıracağı işlemler hazır olsun), en son arayüz. İndekslerin ve TTL
politikalarının oluşması dakikalar sürebilir; konsolda "Etkin" görünene kadar ilgili ekranlar hata verebilir.

`scripts/firebase.mjs`, Firebase CLI'yi Next.js barındırması için gereken deneysel özellik açık olarak
çalıştırır; hosting dağıtımını doğrudan `firebase deploy` ile yapmayın.

### 1.4 İlk eğitim sorumlusu

Yönetim paneli ilk admin olmadan kullanılamaz; ilk admin konsoldan atanır:

1. Uygulamada `/register` üzerinden normal kayıt olun (aydınlatma metni onayı dahil). Ekran "Başvurunuz onay
   bekliyor" der.
2. Gelen e-postadaki bağlantıyla e-posta adresinizi doğrulayın.
3. Firebase konsolu › Firestore › `users/<uid>` dokümanında iki alanı değiştirin: `role: "admin"`,
   `status: "active"`. (`<uid>` Authentication › Kullanıcılar listesindedir.)
4. Açık olan sayfa kendiliğinden panele geçer. İki aşamalı doğrulama zorunlu olduğundan önce "Hesap güvenliği"
   sayfasında Authenticator kurulumu istenir; kurulumdan sonra oturum kapanır ve kodla yeniden girilir.
5. Diğer eğitim sorumluları ve üyeler bundan sonra yönetim panelinden (onay, davet, rol) yönetilir. Konsoldan
   elle rol vermeyi yalnızca bu ilk adım için kullanın: paneldeki işlemler denetim kaydına kişiyle birlikte
   geçer, konsoldaki değişiklik "sistem" olarak görünür.

### 1.5 Dağıtım sonrası kısa kontrol

Otomatik yapılandırma ve servis denetimi için (Firebase CLI oturumu açıkken):

```bash
npm run verify:staging
```

Manuel duman testi (smoke test):

- Giriş › iki aşamalı doğrulama kodu › Genel bakış açılıyor.
- Yönetim paneli › Denetim kayıtları listeleniyor; Ayrıntı'da "ağ kimliği" var (bölüm 2).
- Bir PDF materyal yükleyip hekim hesabıyla açın (Storage CORS).
- Ders başlatıp projektör ekranını açın; telefondan passkey ile katılın (`WEBAUTHN_*` parametreleri).
- Kısa bir sınav yayınlayıp hekim hesabıyla çözün; karne ve sonuçlar görünüyor.
- Tarayıcı konsolunda içerik güvenlik politikası (CSP) ihlali yok.

Ayrıntılı kabul senaryoları: `docs/revision/REVISION_PLAN.md` §F10.3.

### 1.6 Geri alma

- **Arayüz:** Firebase konsolu › Hosting › sürüm geçmişinden önceki sürüme dönün.
- **Cloud Functions ve kurallar:** önceki commit'i çıkarıp aynı dağıtım komutlarını yeniden çalıştırın.
  Kuralların önceki sürümleri konsolda (Firestore › Kurallar › geçmiş) da durur.
- **Veri:** bölüm 5 (PITR / yedekten yeni veritabanına geri yükleme).

## 2. Gizli değerler ve parametreler (dağıtımdan ÖNCE)

| Ad | Tür | Zorunlu | Açıklama |
|---|---|---|---|
| `AUDIT_IP_SALT` | Secret Manager | Evet | Denetim kayıtlarındaki ağ özetinin tuzu. Her callable'a bağlıdır; tanımlı değilse functions dağıtımı başarısız olur. |
| `AUDIT_RETENTION_DAYS` | Parametre | Hayır (varsayılan 730) | Denetim kayıtlarının saklama süresi (gün). **Kurumun saklama politikasına göre belirleyin.** En az 30; geçersiz değer 730 sayılır. |
| `ENFORCE_APP_CHECK` | Parametre | Hayır (varsayılan `true`) | Canlıda `true` kalmalıdır. |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGINS` | Parametre | Evet | Yoklama cihazı (passkey) için alan adı ve kökenler. |

Tuzu oluşturma (değer en az 16 karakter, rastgele olmalı; kimseyle paylaşılmaz, depoya yazılmaz):

```bash
openssl rand -hex 32
```

```bash
node scripts/firebase.mjs functions:secrets:set AUDIT_IP_SALT
```

Parametreler proje bazlı dosyada tutulur (`functions/.env.<proje-kimliği>`, git'e girmez), örneğin:

```bash
echo "AUDIT_RETENTION_DAYS=730" >> functions/.env.<proje-kimliği>
```

Notlar:

- Tuz değiştirilirse eski ve yeni kayıtların ağ özetleri artık eşleşmez (karşılaştırma yalnızca aynı tuz
  dönemindeki kayıtlar arasında anlamlıdır). Tuzu yalnızca sızdığından şüphelenirseniz değiştirin.
- `functions/.secret.local` yalnızca emülatör içindir; gizli değildir ve dağıtıma dahil edilmez
  (`firebase.json` → `ignore: *.local`).

**Doğrulama:** Dağıtımdan sonra yönetim panelinde herhangi bir işlem yapın; Denetim kayıtları › Ayrıntı'da
"ağ kimliği" görünmelidir. Görünmüyorsa tuz bağlanmamıştır.

## 3. Denetim kayıtları: saklama ve otomatik silme

- Her denetim kaydı yazılırken `expireAt = yazım anı + AUDIT_RETENTION_DAYS` alır.
- Silmeyi Firestore **TTL politikası** yapar. Politika `firestore.indexes.json` içindedir
  (`audit_logs.expireAt` ve hız sınırı sayaçları için `rate_limits.expireAt`) ve indekslerle birlikte dağıtılır:

```bash
node scripts/firebase.mjs deploy --only firestore:indexes
```

- TTL silmesi anlık değildir; Firestore süresi dolan kayıtları genellikle 24 saat içinde siler.
- Saklama süresini değiştirmek yalnızca **sonradan yazılan** kayıtları etkiler. `expireAt` alanı olmayan eski
  kayıtlar (bu özellikten önce yazılanlar) kendiliğinden silinmez.
- Silinen bir üyenin e-postası, kendi yaptığı işlemlerin denetim kayıtlarında saklama süresi dolana kadar kalır
  (güvenlik kaydı). KVKK aydınlatma metnindeki saklama süresi bununla tutarlı olmalıdır.

**Doğrulama:** Firebase konsolu › Firestore › TTL sekmesinde `audit_logs` ve `rate_limits` için `expireAt`
politikaları "Etkin" görünmelidir.

## 4. Alarmlar

### 4.1 Kritik güvenlik olayları

Önem derecesi `CRITICAL` olan her denetim olayı (ör. üye silme, başka cihazla yoklama denemesi) ayrıca Cloud
Logging'e işaretli bir hata satırı olarak yazılır. Satırda kişisel veri yoktur (yalnızca eylem, kaynak ve
kullanıcı kimlikleri).

Google Cloud konsolu › Logging › Log tabanlı uyarılar › Uyarı oluştur; süzgeç:

```
severity>=ERROR
jsonPayload.audit="CRITICAL"
```

Bildirim kanalı olarak eğitim sorumlusunun ve platform yöneticisinin e-postasını ekleyin. Olayın ayrıntısı
yönetim panelinde Denetim kayıtları › Önem: Kritik altında görülür.

### 4.2 Hata oranı

Aynı yerden ikinci bir uyarı: functions hataları (`severity>=ERROR`, `jsonPayload.audit` olmayanlar) için,
örneğin 5 dakikada 10'dan fazla satır.

### 4.3 Bütçe

Google Cloud konsolu › Faturalandırma › Bütçeler ve uyarılar: aylık bütçe ve %50 / %90 / %100 eşiklerinde
e-posta. (Bütçe uyarısı harcamayı durdurmaz; yalnızca haber verir.)

**Doğrulama:** Staging'de bir test üyesini silin; birkaç dakika içinde kritik olay e-postası gelmelidir.

## 5. Yedekleme ve geri yükleme

Firestore (üyeler, yoklama, sınav, denetim kayıtları):

```bash
gcloud firestore databases update --database='(default)' --enable-pitr
```

```bash
gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=14d
```

- **PITR** (zamanda geri dönüş) son 7 gün içindeki herhangi bir ana dönmeyi sağlar; yanlışlıkla silme ve hatalı
  toplu değişiklikler içindir.
- **Zamanlanmış yedek** daha uzun saklama içindir. Saklama süresini kurum politikasına göre seçin.
- Geri yükleme her zaman **yeni bir veritabanına** yapılır; canlı veritabanının üzerine yazılmaz. Yeni
  veritabanını doğrulayıp uygulamayı ona yönlendirmek ayrı bir karardır.

Cloud Storage (eğitim materyalleri, sınav görselleri): kovada "geçici silme" (soft delete) veya nesne sürümleme
açık olmalıdır; böylece silinen bir materyal dosyası saklama süresi içinde geri alınabilir.

Kimlik doğrulama hesapları Firestore yedeğine dahil DEĞİLDİR. Gerekirse:

```bash
node scripts/firebase.mjs auth:export hesaplar.json --format=json
```

(Dosya kişisel veri ve şifre özetleri içerir; şifreli ve erişimi kısıtlı bir yerde saklayın.)

**Doğrulama (yılda en az bir kez):** Bir yedeği geçici bir veritabanına geri yükleyip üye, yoklama ve sınav
kayıtlarının okunabildiğini kontrol edin. Denenmemiş yedek, yedek sayılmaz.

## 6. Hız sınırları

Sunucu, üye başına aşağıdaki sınırları uygular; aşan istek işlenmeden reddedilir ("Çok fazla deneme yapıldı…")
ve pencere başına bir denetim kaydı (`RATE_LIMIT_EXCEEDED`, Uyarı) düşer.

| İşlem | Sınır | Amaç |
|---|---|---|
| Yoklama: cihaz doğrulaması isteme | 10 / dakika | Kod tahmini ve deneme seli |
| Yoklama: kod gönderme | 10 / dakika | Kod tahmini |
| Kayıt tamamlama | 5 / dakika | Davet kodu tahmini |
| Kişisel veri dökümü | 5 / dakika | Pahalı okuma |

Değerler `functions/src/rateLimit.ts` içindedir. Giriş denemeleri Firebase Authentication'ın kendi korumasına
tabidir. App Check tek kullanımlık belirteçleri (replay koruması) bu sürümde açık değildir; gerekirse ayrı bir
iş olarak eklenebilir.

## 7. Yoklamada "aynı ağ" işareti

Projektör ekranının ve katılan her hekimin ağ özeti karşılaştırılır; farklı ağdan gelen katılım **engellenmez**
ama denetim kaydında işaretlenir (`sameNetworkAsProjector: false`). Mobil veri kullanan dürüst bir hekim de
farklı ağda görünür; bu işaret tek başına kanıt değildir, yalnızca inceleme için ipucudur.

**Doğrulama:** Staging'de hastane ağından ve mobil veriden birer katılım yapıp kayıtları karşılaştırın. Ağ özeti,
Google ön ucunun `X-Forwarded-For` başlığına eklediği son adrese dayanır; functions'ın önüne başka bir vekil
(proxy) konursa `functions/src/requestContext.ts` gözden geçirilmelidir.
