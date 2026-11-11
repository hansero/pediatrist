# Pediatrist — Dağıtım ve Operasyon

Bu belge canlı (ve staging) ortamın kurulması ve işletilmesi içindir. Yerel geliştirme için `README.md`'ye bakın.

> **Durum:** Bu belgedeki operasyon adımları (bölüm 2–6) kod tarafında hazırdır ve emülatörde test edilmiştir;
> ancak **gerçek bir Firebase projesinde henüz denenmemiştir**. İlk staging kurulumunda her bölümün sonundaki
> "Doğrulama" adımını uygulayın (REVISION_PLAN F10.2).

## 1. Dağıtım sırası ve ilk kurulum

Dağıtım sırası, ilk eğitim sorumlusunun oluşturulması ve ortam değişkenleri REVISION_PLAN F9.3'te bu bölüme
yazılacaktır. O zamana kadar: `docs/revision/REVISION_PLAN.md` §F10.2 kontrol listesi geçerlidir.

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
firebase functions:secrets:set AUDIT_IP_SALT
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
firebase deploy --only firestore:indexes
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
firebase auth:export hesaplar.json --format=json
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
