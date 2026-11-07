# Pediatrist — Pediatri Eğitim Kliniği Yönetim ve Eğitim Platformu Mimari Planı (`Plan.MD`)

## 1. Proje Vizyonu ve Genel Bakış
**Pediatrist**, bir Pediatri Eğitim Kliniğindeki asistan hekimlerin, uzmanların ve öğretim üyelerinin klinik eğitim süreçlerini tek bir güvenli çatı altında toplamak için tasarlanmış, **%100 Firebase yerel (native) altyapısı** üzerinde çalışan, **sadece onaylı üyelerin erişebildiği (invite-only / admin-approved)** ve **ileri siber güvenlik** standartlarına sahip web tabanlı (PWA uyumlu) bir eğitim ve klinik karar destek platformudur.

### Temel İlkeler
- **%100 Entegre Firebase Mimarisi:** Harici tablo veya üçüncü parti bulut sürücülerine bağımlılık olmadan; kimlik doğrulama, veritabanı, dosya/görsel depolama, sunucu tarafı doğrulama ve barındırma işlemleri tamamen **Firebase (Auth, Firestore, Cloud Storage, Cloud Functions, App Check, Hosting)** üzerinde uçtan uca entegre çalışır.
- **Kapalı Devre Üyelik:** Dışarıdan serbest erişim kapalıdır. Yalnızca klinik yöneticisi (`Admin`) tarafından onaylanan veya kurumsal davet (`invitations`) ile kabul edilen üyeler sisteme girebilir.
- **Rol Tabanlı Erişim Kontrolü (RBAC):** `Admin` (Eğitim Sorumlusu / Öğretim Üyesi / Başasistan) ve `User` (Pediatri Asistanı / Uzman Hekim) rolleri **Firebase Custom Claims**, **Firestore Security Rules** ve **Storage Security Rules** ile hem istemci hem sunucu katmanında zorunlu tutulur.
- **Ayrı Sayfa ve Modüler Yönetim:** Her ana fonksiyon kendi bağımsız sayfasında (`/materials`, `/calculators`, `/attendance`, `/quizzes`) görüntülenir ve yetkiye göre aynı modül içinden yönetilir.
- **İleri Seviye Siber Güvenlik (Zero-Trust):** Çok faktörlü kimlik doğrulama (MFA/TOTP), Firebase App Check, cihaz/biyometrik bağlama (`WebAuthn`), 15 saniyede bir kriptografik değişen dinamik QR yoklama, filigranlı materyal görüntüleme, sunucu tarafı sınav değerlendirmesi ve değiştirilemez denetim kayıtları (`audit_logs`).

---

## 2. Teknoloji Yığını (Tech Stack)

| Katman | Teknoloji | Görevi ve Entegrasyon Rolü |
| :--- | :--- | :--- |
| **Frontend Çatısı** | **Next.js 15 (App Router) + TypeScript** | Güçlü tip güvenliği, modüler sayfa yapısı, rota koruma kalkanları ve mobil PWA desteği. |
| **Stil & Tasarım Sistemi** | **Vanilla CSS (`src/styles/index.css`) + CSS Custom Properties** | Maksimum esneklik ve kontrol sağlayan HSL tabanlı klinik tasarım tokenları, akıcı (fluid) responsive düzen ve sıfır harici CSS çatısı bağımlılığı. |
| **Veri Görselleştirme & İkon** | **Recharts + Lucide Icons** | Hekim kişisel gelişim eğrileri, karşılaştırmalı sınav analiz grafikleri ve klinik arayüz ikonografisi. |
| **Kimlik Doğrulama** | **Firebase Authentication (Identity Platform)** | E-posta/Şifre + Zorunlu **MFA (TOTP)**, Custom Claims (`role: 'admin' \| 'user'`, `status: 'active' \| 'pending' \| 'suspended'`), anlık oturum iptali. |
| **Veritabanı** | **Cloud Firestore** | Gerçek zamanlı dinleyiciler (`onSnapshot`) ile canlı yoklama, aktif sınav seansları, soru arşivi ve kişisel gelişim takibi. |
| **Dosya & Görsel Depolama** | **Firebase Cloud Storage** | Eğitim materyallerinin (PDF, video, sunum) ve sınavlardaki klinik/radyoloji vaka görsellerinin yetki korumalı depolanması (`storage.rules`). |
| **Sunucu Mantığı** | **Firebase Cloud Functions (2nd Gen, TypeScript)** | Kriptografik yoklama doğrulaması, sınav cevaplarının sunucu tarafında değerlendirilmesi, otomatik soru arşivleme ve `audit_logs` yazımı. |
| **Bot & API Koruması** | **Firebase App Check (reCAPTCHA Enterprise)** | Yetkisiz istemcilerin veya botların Firebase API'lerine doğrudan istek atmasını engeller. |
| **Barındırma** | **Firebase App Hosting / Hosting** | Otomatik SSL/TLS, global CDN ve sıkı HTTP güvenlik başlıkları (`CSP`, `HSTS`, `X-Frame-Options`). |

### 2.1. Klinik UI/UX Tasarım Sistemi ve Web Geliştirme Standartları
- **İşlev Odaklı Klinik Tasarım (Function-Driven Design):** Pediatri acil, yoğun bakım ve poliklinik temposunda hekimlerin en az tıklama ve sıfır bilişsel yükle hedefe ulaşmasını sağlayan sade, sezgisel ve hızlı bilgi hiyerarşisi.
- **HSL Renk Paleti ve Tipografi (`src/styles/index.css`):**
  - Göz yormayan klinik arduvaz/beyaz yüzey tonları, güven veren tıbbi kobalt/turkuaz vurgu renkleri ve doz aşımı/kritik sınır uyarıları için yüksek kontrastlı semantik HSL renk tokenları (`--color-clinical-primary`, `--color-alert-critical`, `--surface-elevated`).
  - Okunabilirliği maksimuma çıkaran Google Fonts kombinasyonu: Klinik vaka metinleri ve arayüz için **`Plus Jakarta Sans`**, ilaç dozları, hesaplama çıktıları, geri sayım sayaçları ve 6 haneli yoklama kodları için **`JetBrains Mono` (`font-variant-numeric: tabular-nums`)**.
  - **Görsel Disiplin (Anti-Cliché Kuralları):** Koyu zeminde mor/neon parlamalar, gradyan metin dolguları, aşırı iç içe geçmiş (over-nested) kartlar veya dekoratif karmaşa kesinlikle kullanılmaz; her piksel klinik bir işleve hizmet eder.
- **Semantik HTML5, Erişilebilirlik ve Benzersiz Kimlikler (`Unique IDs`):**
  - Her bağımsız sayfa (`/materials`, `/calculators`, `/attendance`, `/quizzes`, `/admin`) kendine özgü `<title>`, `<meta name="description">`, tek bir `<h1>` başlık hiyerarşisi ve semantik HTML5 etiketleri (`<main>`, `<section>`, `<article>`, `<nav>`, `<aside>`) içerir.
  - Tüm etkileşimli form elemanları ve butonlar deterministik test ve erişilebilirlik için benzersiz, açıklayıcı `id` niteliklerine sahiptir (Örn: `id="calc-weight-kg-input"`, `id="attendance-scan-qr-btn"`, `id="quiz-submit-attempt-btn"`).

---

## 3. İleri Seviye Siber Güvenlik Mimarisi (Advanced Cybersecurity)

Klinik eğitim verileri, hekim bilgileri ve yoklama/sınav bütünlüğü için **7 katmanlı Zero-Trust güvenlik modeli** uygulanacaktır:

### 3.1. Kimlik ve Erişim Güvenliği
1. **Kapalı Kayıt & Admin Onayı (Allowlist / Approval Flow):**
   - Kullanıcı kayıt olduğunda varsayılan durumu `status: "pending"` olur ve hiçbir klinik sayfaya erişemez (`/pending` ekranında bekler).
   - Yalnızca `Admin` tarafından onaylanan veya önceden e-postası davet listesine (`invitations` koleksiyonu) eklenen kullanıcılar `Custom Claims` (`{ role: 'user', status: 'active' }`) alır.
2. **Zorunlu Çok Faktörlü Doğrulama (MFA):**
   - Firebase Auth üzerinden TOTP (Google / Microsoft Authenticator) tabanlı 2 aşamalı doğrulama zorunlu tutulur.
3. **Otomatik Oturum Zaman Aşımı (Idle Timeout) & Token İptali:**
   - Klinik bilgisayarlarda açık unutulan oturumlar 15 dakika hareketsizlik sonrasında otomatik kilitlenir.
   - Rol değişimi veya şüpheli işlemde Cloud Function üzerinden `admin.auth().revokeRefreshTokens(uid)` çağrılarak aktif oturumlar anında sonlandırılır.

### 3.2. Uygulama ve API Güvenliği
1. **Firebase App Check:**
   - Firestore, Cloud Storage ve Callable Cloud Functions üzerinde `enforceAppCheck: true` aktif edilir. Uygulama arayüzü dışından (cURL, Postman, script) gelen tüm istekler reddedilir.
2. **Sunucu Tarafı Doğrulama (Zero Client Trust):**
   - Sınavların doğru cevapları (`correctAnswers`), pedagojik açıklamaları (`feedbackText`) ve yoklama oturumlarının gizli HMAC anahtarları **asla** sınav/yoklama esnasında istemciye gönderilmez. Puanlama ve doğrulama yalnızca **Cloud Functions** üzerinde çalışır.
3. **Sıkı Güvenlik Başlıkları (HTTP Security Headers):**
   - `Content-Security-Policy (CSP)`, `Strict-Transport-Security (HSTS)`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.

#### 3.3. Veri, Dosya ve Denetim Güvenliği
1. **Eğitim Materyali ve Vaka Görseli Sızıntı Önleme:**
   - Firebase Cloud Storage içindeki eğitim dosyaları ve klinik sınav görselleri herkese açık (`public`) değildir; yalnızca `request.auth.token.status == 'active'` olan üyeler okuyabilir.
   - İndirmeye kapalı eğitim materyalleri uygulama içinde aktif hekimin **Adı Soyadı + E-postası + Tarih/Saat** bilgisini içeren **dinamik filigran (watermark)** ile görüntülenir (ham cihaz kimliği filigrana veya ekrana yansıtılmaz).
2. **Değiştirilemez Denetim Kayıtları (`audit_logs`):**
   - Giriş/çıkışlar, materyal görüntüleme, yoklama doğrulamaları, sınav seansı başlatma/bitirme ve yetki değişiklikleri yalnızca Cloud Functions tarafından yazılabilen (istemci tarafından silinemeyen ve değiştirilemeyen) `audit_logs` koleksiyonunda tutulur.

### 3.4. Kimlik Bilgisi ve Altyapı Sızıntısı Önleme (Zero Credential & Identifier Exposure)
1. **Arayüzde Sıfır Altyapı Bilgisi:**
   - Hiçbir kullanıcı (`User`) veya yönetici (`Admin`) ekranında Firebase `projectId`, `apiKey`, `authDomain`, `storageBucket`, `messagingSenderId`, `appId`, ham cihaz kimliği (`boundDeviceId`) veya beklenen 15 saniyelik HMAC doğrulama kodu paylaşılmaz.
   - `src/lib/firebase/client.ts` yapılandırma nesnesini dışa aktarmaz; yalnızca `isFirebaseConfigured()` ile boolean bağlantı durumu döndürür.
2. **Ortam Değişkeni İzolasyonu ve Cihaz Özeti (Hashing):**
   - Tüm Firebase anahtarları kaynak kodda sabit (`hardcoded`) tutulmaz; yalnızca git'e girmeyen `.env.local` ve sunucu ortam değişkenlerinden okunur (`src/lib/firebase/admin.ts` üzerinde `server-only` koruması bulunur).
   - Kişisel cihaz bağlama (`Device Binding`) veritabanında ham cihaz kimliği yerine tek yönlü `SHA-256` özeti (`boundDeviceHash`) olarak saklanır.
3. **Kesin Rol Ayrımı (Uygulama İçi Rol Değiştirme Yok):**
   - Arayüzde istemci taraflı `viewMode` veya "Rol Değiştir" anahtarı bulunmaz; kullanıcı rolü yalnızca Firebase Authentication ID Token (`Custom Claims`) üzerinden (`ClinicSessionContext`) okunur.

---

## 4. Sayfa Yapısı ve Modül Tasarımları

Her bir ana fonksiyon **ayrı bir sayfada** gösterilir ve kullanıcının doğrulanmış rolüne (`Admin` veya `User`) göre kesin olarak ayrılmış yetkilerle çalışır.

```mermaid
flowchart TD
    Auth["Giriş & 2FA Doğrulama (/login)"] --> Check{"Üyelik & Onay Durumu"}
    Check -- "Onaysız / Beklemede" --> Pending["Onay Bekleme Ekranı (/pending)"]
    Check -- "Onaylı (Admin / User)" --> Dash["Ana Gösterge Paneli (/dashboard)"]

    Dash --> P1["1. Eğitim Materyalleri (/materials)"]
    Dash --> P2["2. Pediatri Hesaplamaları (/calculators)"]
    Dash --> P3["3. Ders Katılım Kontrolü (/attendance)"]
    Dash --> P4["4. Online Quiz (/quizzes)"]
    Dash --> P5["5. Kullanıcı & Güvenlik Yönetimi (/admin)"]

    P1 --> P1_U["User: Kategori/Kıdem Filtreleme, Filigranlı Okuma/İzleme, İlerleme Takibi"]
    P1 --> P1_A["Admin: Firebase Storage Dosya Yükleme, Kıdem Etiketleme, Okunma Raporu"]

    P2 --> P2_U["User: Doz, Sıvı, Persentil, Yenidoğan, Acil Skor Hesaplama"]
    P2 --> P2_A["Admin: Formül/İlaç Sınırı Güncelleme, Klinik Protokol Notu Ekleme"]

    P3 --> P3_U["User: Admin'in Başlattığı Aktif Derse Yoklama Verme + Kişisel Katılım Geçmişi"]
    P3 --> P3_A["Admin: Dersi Başlatma/Bitirme, 15 sn Dinamik QR Projektör, Ders & Katılımcı Bazlı Log Dashboard'u"]

    P4 --> P4_U["User: Sadece Aktif Sınava Katılma, Soruları Çözme, Eski & Şimdiki Sınav Logları Dashboard'u"]
    P4 --> P4_A["Admin: 9 Sütunlu CSV Yükleme, Sınavı Önizleme, Süre Belirleme, Yayına Alma + Tüm Kullanıcı/Sınav Log Dashboard'u"]

    P5 --> P5_A["Admin: Üye Onayı, Kıdem/Rol Atama, Cihaz Bağı Sıfırlama, Audit Logs"]
```

---

### Modül 1: Eğitim Materyalleri Paylaşma ve Görüntüleme (`/materials`)
Klinik içi ders sunumları, güncel pediatri kılavuzları (AAP, ESPGHAN, Türk Pediatri Kurumu vb.), makaleler ve eğitim videolarının yönetildiği sayfadır.

- **Hekim (`User`) Görünümü:**
  - **Kategori & Kıdem Filtreleme:** Yenidoğan, Çocuk Acil, Çocuk Yoğun Bakım, Enfeksiyon, Nefroloji, Kardiyoloji vb. bilim dallarına ve asistan kıdem yılına (1. Yıl, 2. Yıl, 3. Yıl, 4. Yıl, Tüm Klinik) göre filtreleme.
  - **Güvenli Uygulama İçi Görüntüleyici:** PDF ve sunumlar Firebase Cloud Storage üzerinden güvenli akışla çekilir; üzerinde aktif kullanıcının adı-soyadı, e-postası ve zaman damgası bulunan dinamik filigran (watermark) ile görüntülenir (`allowDownload: false` olan materyaller için indirme/yazdırma engellenir).
  - **Okundu / Tamamlandı Takibi:** Hekimin hangi materyali ne kadar süre incelediği kaydedilir; zorunlu materyaller için kişisel ilerleme yüzdesi gösterilir.
- **Yönetici (`Admin`) Yönetim Fonksiyonları:**
  - Doğrudan Firebase Cloud Storage'a materyal yükleme (PDF, Video, Sunum).
  - Materyal meta verilerini düzenleme (Başlık, Bilim Dalı, Hedef Kıdem, Zorunlu Okuma mı?, İndirilebilir mi?).
  - Materyali hangi hekimlerin okuyup tamamladığını gösteren **Klinik Okunma Raporu**.

---

### Modül 2: Pediatri Hesaplama Uygulamaları (`/calculators`)
Klinik pratikte ve eğitimde en sık kullanılan, hata payını sıfıra indirmeyi amaçlayan doğrulanmış pediatrik tıbbi hesaplayıcılar sayfasıdır.

- **Hesaplama Araçları (Alt Sekmeler / Kartlar):**
  1. **Antropometri & Büyüme:** Yaş/Cinsiyete göre Persentil ve Z-Skoru (Boy, Kilo, Baş Çevresi, VKİ — WHO & Neyzi referansları), Vücut Yüzey Alanı (**BSA** — Mosteller & Haycock formülleri).
  2. **Pediatrik Sıvı & Elektrolit Yönetimi:** **Holliday-Segar** idame sıvı hesaplama, dehidratasyon derecesine göre defisit + idame sıvı planı, hipernatremi/hiponatremi düzeltme hızı.
  3. **Pediatrik İlaç & Acil Resüsitasyon Dozları (PALS / NRP):** Kilo bazlı adrenalin, adenozin, amiodaron, antiepileptikler, antibiyotik dozları ve **Broselow** renk/kilo bandı (entübasyon tüp çapı, derinliği, defibrilasyon joule hesabı).
  4. **Yenidoğan (Neonatoloji) Hesaplayıcıları:** Saatlik postnatal yaşa ve gebelik haftasına göre **Fototerapi & Kan Değişimi (Bilirubin)** eşikleri, düzeltilmiş yaş hesabı, Apgar skoru.
  5. **Klinik Skorlamalar ve Böbrek Fonksiyonu:** Pediatrik Glasgow Koma Skalası (pGCS), **Bedside Schwartz** formülü ile eGFR, PEWS (Pediatrik Erken Uyarı Skoru), Westley Krup Skoru, PRAM Astım Skoru.
- **Hekim (`User`) Görünümü:**
  - Hızlı arama, yaş/kilo girildiğinde acil parametrelerin anlık hesaplanması ve "Aşırı Doz / Fizyolojik Sınır Dışı Değer" güvenlik uyarıları (Guardrails).
  - Hasta mahremiyeti (KVKK) gereği girilen hasta ölçümleri veritabanına **kaydedilmez**, yalnızca anlık tarayıcı belleğinde hesaplanır.
- **Yönetici (`Admin`) Yönetim Fonksiyonları:**
  - Hesaplayıcıların altına Firestore tabanlı **"Klinik Protokol Notu"** ekleme/güncelleme.
  - İlaç doz aralıklarını ve maksimum doz sınırlarını (`maxDose`) yönetme.

---

### Modül 3: Derslere Katılım Kontrolü — Personal Real-Time Authentication (`/attendance`)
Klinik sabah toplantıları, makale saatleri, mortalite toplantıları ve teorik derslerde **başkasının yerine imza atmayı veya ekran görüntüsüyle uzaktan yoklama vermeyi imkansız kılan** gerçek zamanlı kişisel doğrulama sayfasıdır.

- **Kriptografik & Cihaz Bağlamlı Yoklama Protokolü:**
  1. **Yoklama Alınacak Dersi Admin Başlatır (`startLectureSession`):** Yoklama yalnızca `Admin` tarafından ders başlığı, eğitici, kategori ve yoklama açık kalma süresi (dakika) belirlenerek başlatıldığında açılır. Aktif ders yokken hekim ekranında yoklama girişi kapalıdır.
  2. **Canlı Projektör Ekranı (`getProjectorCode`):** Canlı ders süresince projektöre **her 15 saniyede bir kriptografik olarak yenilenen (HMAC-SHA256) 6 haneli tek kullanımlık doğrulama kodu** yansıtılır.
  3. **Kişisel Doğrulama (`User` — `verifyRealTimeAttendance`):**
     - **Adım A (Kişisel Cihaz & Biyometrik Onay):** Hekimin hesabına bağlı birincil cihaz özeti (`boundDeviceHash`) ve **WebAuthn / Biyometrik onay** ile cihazın o hekime ait olduğu doğrulanır (ham cihaz kimliği hiçbir ekranda gösterilmez).
     - **Adım B (15 Saniyelik Kod Doğrulaması):** Projektördeki güncel kod girilir/okutulur; sunucu kodun son 15 saniyelik pencereye ait olduğunu ve aynı cihazdan başka bir hekime yoklama verilmediğini doğrulayarak kaydı `attendance_sessions/{sessionId}/records/{uid}` ve `attendance_logs` koleksiyonlarına yazar.
- **Hekim (`User`) Görünümü:**
  - Yalnızca Admin tarafından başlatılmış canlı ders varsa yoklama doğrulama formu.
  - Hekimin **yalnızca kendi geçmiş ders katılımlarını** gördüğü Kişisel Ders Katılım Geçmişi tablosu.
- **Yönetici (`Admin`) Katılım Yönetimi ve Log Dashboard'u:**
  1. **Ders Başlatma & Canlı Projektör:** Yeni ders yoklaması başlatma, süreyi belirleme, canlı projektör kodunu yansıtma, mazeretli (`excused`) işaretleme ve yoklamayı kapatma (`endLectureSession`).
  2. **Ders Bazlı Katılım Log Dashboard'u:** Tüm derslerin listesi, her dersin katılım yüzdesi, seçilen dersteki tüm hekimlerin katılım/mazeret/doğrulama saati/yöntem logları ve tek tıkla CSV dışa aktarım.
  3. **Katılımcı (Hekim) Bazlı Katılım Log Dashboard'u:** Her bir hekimin katıldığı/mazeretli olduğu/katılmadığı ders sayısı, genel katılım yüzdesi (`<%70` uyarı rozeti), hekime tıklandığında açılan tüm ders geçmişi logları ve CSV dışa aktarım.

---

### Modül 4: Online Quiz ve Klinik Vaka Değerlendirme Yapısı (`/quizzes`)

Tamamen **Firebase Firestore, Firebase Cloud Storage ve Cloud Functions** üzerinde çalışan; `User` ve `Admin` yetkilerinin kesin olarak ayrıldığı sınav modülüdür.

#### 4.1. Standart 9 Alanlı Klinik Soru Veri Modeli ve CSV Yapısı
Her bir sınav sorusu, mevcut 9 sütunlu CSV yapısına birebir uyumlu olan **9 standart alandan** oluşur:

| Sıra | CSV Sütun Başlığı | Sistem Alanı (Firestore) | Açıklama ve Sistem Davranışı |
| :---: | :--- | :--- | :--- |
| **1** | **Soru İçeriği** | `caseContent` | Klinik vaka sunumu, hasta öyküsü, fizik muayene ve laboratuvar bulguları. |
| **2** | **Soru Görseli** | `imageUrl` | Opsiyonel klinik, radyoloji, EKG veya laboratuvar görseli (`https://` veya `quiz_media/`). |
| **3** | **Sorunun Kendi** | `questionText` | Vakanın altında yer alan doğrudan soru cümlesi. |
| **4** | **Soru Tipi** | `questionType` | `Single Choice` (Tek Seçmeli), `Multiple Choice` (Çoklu Seçmeli) veya `Text Input` (Açık Uçlu Metin). |
| **5** | **Maximum Length** | `maxLength` | `Text Input` soruları için geçerli maksimum karakter sınırı (`1..2000`). |
| **6** | **Seçenekler** | `optionsRaw` | Şıkların `\|` ile ayrıldığı metin (Örn: `Sepsis \| Meningokoksemi \| Kawasaki \| Kızıl`). |
| **7** | **Seçenekler (JSON)** | `optionsArray` | JSON dizi formatındaki seçenekler (`["Sepsis", "Meningokoksemi", ...]`) veya 6. sütundan otomatik dönüştürülen dizi. |
| **8** | **Doğru Seçenek (JSON)** | `correctAnswers` | Tekli seçim (`["Kawasaki"]`), çoklu seçim veya açık uçlu kabul edilen doğru yanıt varyasyonları. |
| **9** | **Feedback_Text** | `feedbackText` | Sorunun doğru veya yanlış yanıtlanmasından bağımsız olarak sınav sonunda hekime açılan **Öğrenme Noktası**. |

> [!IMPORTANT]
> **Sınav Güvenliği (Cevap ve Feedback İzolasyonu):** Sınav devam ederken istemciye (hekimin tarayıcısına) yalnızca yayındaki sınavın **1–7. alanları** (`questions_public`) gönderilir. **8. alan (`correctAnswers`)** ve **9. alan (`feedbackText`)** istemciye tamamen kapalı olan `quiz_answer_keys` koleksiyonunda tutulur ve yalnızca hekim sınavı bitirip teslim ettiği anda (`submitQuizAttempt` Cloud Function) sonuç karnesiyle birlikte açılır.

#### 4.2. Hekim (`User`) Deneyimi (`/quizzes` — Sadece Sınava Katılma ve Kişisel Log Dashboard'u)
`User` rolündeki hekim ekranında **hiçbir Admin yetkisi, soru düzenleme formu veya diğer kullanıcıların verisi yer almaz**:
1. **Aktif Sınava Katılma ve Sınav Sorularını Çözme (`ClinicalExamRunner`):**
   - Hekim yalnızca Admin'in yayına aldığı aktif sınavı (ve Admin'in belirlediği sınav süresini) görerek sınava katılır (`startQuizAttempt`).
   - Sınav süresince geri sayım sayacı ve sekme değiştirme (`VisibilityChange`) takibi çalışır; süre bittiğinde veya hekim teslim ettiğinde yanıtlar sunucuda değerlendirilir (`submitQuizAttempt`).
2. **Anında Geri Bildirim Karnesi (`InstantFeedbackReport`):**
   - Sınav tamamlandığında her sorunun altında hekimin yanıtı, doğru yanıt ve **Öğrenme Noktası (`Feedback_Text`)** anında gösterilir.
3. **Eski ve Şimdiki Sınav Logları Dashboard'u (`DoctorGrowthDashboard`):**
   - Hekim katıldığı **eski sınavların ve şimdiki sınavının loglarını** (tarih, sınav adı, doğru/toplam, puan, başarı gelişim eğrisi) kendi kişisel dashboard'unda takip eder ve istediği sınavın detaylı karnesini tekrar açıp inceleyebilir.

#### 4.3. Yönetici (`Admin`) Deneyimi (`/quizzes` — CSV Yükleme, Önizleme, Süre Belirleme ve Merkezi Log Dashboard'u)
1. **CSV Dosyası Yükleme (`parseNineFieldQuizCsv`):**
   - Admin yeni sınav başlatmak istediğinde mevcut 9 sütunlu sınav yapısına uygun bir `.csv` dosyası yükler (veya örnek 9 sütunlu CSV şablonunu indirir).
   - Sistem her satırı 9 alan kuralına göre doğrular; hatalı satır varsa satır ve sütun numarasıyla Admin'e bildirir ve hatalar giderilene kadar yayına almayı kilitler.
2. **Sınavı Önizleme, Sınav Süresini Belirleme ve Yayına Alma (`AdminQuizStudio`):**
   - Admin yüklenen CSV'deki soruları hekimlerin göreceği biçimde (veya cevap anahtarı + `Feedback_Text` açık olarak) **önizler**.
   - Admin **sınav süresini (dakika, 1–180 dk)** ve sınav başlığını kendisi belirler, ardından **Sınavı Yayına Alır (`saveQuizDraft` + `publishQuiz`)**.
   - Yeni sınav yayına alındığında bir önceki aktif sınav otomatik olarak kapatılır ve soruları 9 alanlı yapısıyla **`quiz_question_archive` (Kayıp Önleyici Soru Arşivi)** koleksiyonuna taşınır.
3. **Tüm Kullanıcı ve Sınavların Loglarını İzleme Dashboard'u (`AdminCentralAnalytics`):**
   - Admin; **Tüm Girişim Logları** (hekim, kıdem, sınav, tarih, doğru/toplam, puan, sekme değiştirme sayısı ve karne detayı), **Kullanıcı (Hekim) Bazlı Özet** ve **Sınav Bazlı Özet** sekmeleriyle tüm hekimlerin ve tüm sınavların loglarını tek bir merkezi dashboard üzerinden takip eder, filtreler ve CSV/Excel olarak indirir.

---

### Modül 5: Kullanıcı, Rol ve Güvenlik Yönetimi (`/admin`)
Yalnızca `Admin` rolüne sahip kullanıcıların erişebildiği yönetim sayfasıdır:
- Bekleyen üyelik başvurularını (`pending`) onaylama / askıya alma (`suspended`).
- Kullanıcı rolü (`Admin` / `User`) ve asistan kıdem yılı (`1..4`) atama.
- Kullanıcının kayıtlı yoklama cihaz bağını (`boundDeviceHash`) sıfırlama.
- Değiştirilemez `audit_logs` (Siber Güvenlik Denetim Kayıtları) izleme ekranı (hiçbir proje kimliği veya API anahtarı ekrana yansıtılmaz).

---

## 5. Firebase Veritabanı Şeması (Cloud Firestore)

```text
firestore-root/
├── users/{uid}
│   ├── email, fullName, title ("Asistan Dr.", "Uzm. Dr.", "Doç. Dr.", "Prof. Dr.")
│   ├── residencyYear (1..4), role ("admin" | "user"), status ("active" | "pending" | "suspended")
│   ├── mfaEnabled (boolean), boundDeviceHash (string | null), webAuthnCredentialId (string | null)
│   └── createdAt, lastLoginAt
│
├── invitations/{inviteId}
│   └── email, intendedRole, residencyYear, invitedBy, expiresAt, used (boolean)
│
├── materials/{materialId}
│   ├── title, description, category, targetYears (array), isMandatory (boolean)
│   ├── storagePath, fileType ("pdf" | "video" | "slides"), allowDownload (boolean)
│   ├── uploadedBy, createdAt, updatedAt
│   └── progress/{uid} -> { viewedAt, durationSeconds, completed (boolean) }
│
├── calculators_config/{calcId}
│   └── name, category, isActive, formulaVersion, clinicalProtocolNote, parameters (map), updatedBy, updatedAt
│
├── attendance_sessions/{sessionId}
│   ├── title, lecturer, category, durationMinutes, status ("live" | "closed")
│   ├── startedAt, endsAt, startedBy, presentCount, excusedCount
│   └── records/{uid} -> { uid, fullName, residencyYear, verifiedAt, method, deviceHash, status ("present" | "excused"), excuseNote }
│
├── attendance_logs/{logId}              <-- Ders ve katılımcı bazlı Admin dashboard sorguları için düz log koleksiyonu
│   └── sessionId, sessionTitle, lecturer, category, uid, fullName, residencyYear, verifiedAt, method, status
│
├── attendance_secrets/{sessionId}       <-- İstemciye tamamen kapalı, sadece Cloud Functions erişir
│   └── hmacSecret, createdAt
│
├── quizzes/{quizId}
│   ├── title, durationMinutes, status ("draft" | "published" | "closed"), sourceFileName
│   ├── createdAt, publishedAt, closedAt, createdBy, questionCount, attemptCount
│   └── questions_public/{questionId}    <-- Yalnızca sınav 'published' iken hekime açılan 1-7. alanlar
│       ├── orderIndex (number)
│       ├── caseContent                  (1: Soru İçeriği - Klinik Vaka Metni)
│       ├── imageUrl                     (2: Soru Görseli - Firebase Storage Yolu/URL)
│       ├── questionText                 (3: Sorunun Kendi)
│       ├── questionType                 (4: "Single Choice" | "Multiple Choice" | "Text Input")
│       ├── maxLength                    (5: Maximum Length - Text Input için karakter sınırı)
│       ├── optionsRaw                   (6: "|" ile ayrılmış ham seçenekler)
│       └── optionsArray                 (7: JSON Array seçenekler)
│
├── quiz_answer_keys/{quizId}            <-- Hekime her zaman kapalı! Sadece Admin & Cloud Functions erişir
│   └── items/{questionId}
│       ├── correctAnswers               (8: Doğru Seçenek JSON Array)
│       └── feedbackText                 (9: Feedback_Text - Pedagojik Öğrenme Noktası)
│
├── quiz_question_archive/{archiveId}    <-- Kayıp Önleyici Soru Arşivi (Yeni sınav yayına alındığında 1-9. alanlar aktarılır)
│   ├── sourceQuizId, sourceQuizTitle, archivedAt, archivedBy
│   ├── caseContent, imageUrl, questionText, questionType
│   └── maxLength, optionsRaw, optionsArray, correctAnswers, feedbackText
│
├── quiz_attempts/{attemptId}
│   ├── quizId, quizTitle, uid, doctorName, residencyYear
│   ├── startedAt, deadline, submittedAt, durationSeconds, status ("in_progress" | "submitted")
│   ├── score (0..100), correctCount, totalQuestions, lateSubmission
│   ├── gradedReport (array of { questionId, isCorrect, userResponse, correctAnswers, feedbackText })
│   └── tabSwitchCount (number)
│
└── audit_logs/{logId}                   <-- Sadece Cloud Functions yazar, Admin okur, kimse silemez
    └── actorUid, actorEmail, action, resourceType, resourceId, severity, timestamp, metadata
```

---

## 6. Firestore & Storage Güvenlik Kuralları Özeti

- **`firestore.rules`:**
  - `/attendance_sessions/{sessionId}`: Hekim yalnızca `status == 'live'` olan aktif dersi okuyabilir; geçmiş dersler ve tüm katılım özetleri (`attendance_logs`) Admin'e (veya hekimin yalnızca kendi `uid` kaydına) açıktır. Yazma işlemleri yalnızca Cloud Functions (`startLectureSession`, `endLectureSession`, `verifyRealTimeAttendance`, `markAttendanceExcused`) üzerinden yapılır.
  - `/quizzes/{quizId}`: `draft` sınavlar yalnızca Admin'e görünür; `questions_public` alt koleksiyonu yalnızca sınav `published` durumundayken hekimlere açılır. `quiz_answer_keys` (8. ve 9. alanlar) ve `quiz_question_archive` hekimlere tamamen kapalıdır.
  - `/quiz_attempts/{attemptId}`: Hekim yalnızca `resource.data.uid == request.auth.uid` olan kendi eski ve şimdiki sınav loglarını okuyabilir; Admin tüm kullanıcı ve sınav loglarını okuyabilir.
  - `/audit_logs/{logId}`: İstemci yazımı tamamen kapalıdır (`allow write: if false`).

---

## 7. Proje Dizin Yapısı

```text
pediatrist/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx               # 2FA destekli giriş ekranı
│   │   │   ├── register/page.tsx            # Davet kodu / kurumsal e-posta ile başvuru
│   │   │   └── pending/page.tsx             # Admin onayı bekleme ekranı
│   │   ├── (protected)/
│   │   │   ├── layout.tsx                   # ClinicSessionProvider + SessionGuard + Rol bazlı navigasyon (Rol değiştirme butonu yok)
│   │   │   ├── dashboard/page.tsx           # Klinik özet ekranı
│   │   │   ├── materials/page.tsx           # 1. Sayfa: Eğitim Materyalleri
│   │   │   ├── calculators/page.tsx         # 2. Sayfa: Pediatri Hesaplamaları (Yer Tutucu Mimari)
│   │   │   ├── attendance/page.tsx          # 3. Sayfa: Ders Katılım Kontrolü (Admin Ders Başlatma + Ders/Katılımcı Log Dashboard'u)
│   │   │   ├── quizzes/page.tsx             # 4. Sayfa: Online Quiz (User Sınav/Loglar + Admin CSV Yükleme/Önizleme/Süre/Merkezi Log Dashboard'u)
│   │   │   └── admin/page.tsx               # 5. Sayfa: Üye Onayı, Rol Yönetimi, Cihaz Bağı Sıfırlama ve Audit Logs (Sıfır credential sızıntısı)
│   ├── styles/
│   │   └── index.css                        # Merkezi Vanilla CSS tasarım sistemi
│   ├── components/
│   │   ├── materials/                       # WatermarkedMaterialViewer (cihaz ID içermez), AdminMaterialManager
│   │   ├── attendance/                      # AdminLiveAttendanceProjector (Ders & Katılımcı Dashboard'lu), DoctorRealTimeCheckIn
│   │   ├── quizzes/
│   │   │   ├── DoctorGrowthDashboard.tsx    # Hekim kişisel gelişim eğrisi, eski + şimdiki sınav logları ve aktif sınav kartı
│   │   │   ├── ClinicalExamRunner.tsx       # Admin'in belirlediği süreyle çalışan 3 tipli vaka sınav motoru
│   │   │   ├── InstantFeedbackReport.tsx    # Sınav sonu anında açılan Feedback_Text (Öğrenme Noktası) karnesi
│   │   │   ├── AdminCentralAnalytics.tsx    # Tüm kullanıcı ve sınav logları dashboard'u (Tüm Loglar / Hekim Bazlı / Sınav Bazlı)
│   │   │   └── AdminQuizStudio.tsx          # 9 sütunlu CSV yükleme, doğrulama, önizleme, sınav süresi belirleme ve yayına alma stüdyosu
│   │   └── security/                        # SessionGuard (15 dk hareketsizlik kilidi + RBAC)
│   ├── lib/
│   │   ├── auth/
│   │   │   └── ClinicSessionContext.tsx     # Firebase ID Token Custom Claims tabanlı oturum sağlayıcı
│   │   ├── firebase/
│   │   │   ├── client.ts                    # Yalnızca ortam değişkenlerinden okuyan, config sızdırmayan Firebase istemcisi
│   │   │   ├── admin.ts                     # server-only korumalı Firebase Admin SDK
│   │   │   ├── callables.ts                 # Cloud Functions istemci sarmalayıcıları
│   │   │   └── hooks.ts                     # Gerçek zamanlı Firestore sorgu ve güvenli CSV dışa aktarım yardımcıları
│   │   ├── pediatrics/                      # 5 hesaplama grubu yer tutucu kataloğu
│   │   └── quiz-parser/                     # 9 sütunlu RFC 4180 CSV ayrıştırıcı, doğrulayıcı, şablon üretici ve puanlayıcı
├── functions/                               # Firebase Cloud Functions (2nd Gen)
│   └── src/
│       ├── authTriggers.ts                  # Üye onayı, Custom Claims ve cihaz özeti (boundDeviceHash) sıfırlama
│       ├── attendanceService.ts             # startLectureSession, endLectureSession, getProjectorCode, verifyRealTimeAttendance, markAttendanceExcused
│       ├── quizService.ts                   # saveQuizDraft, publishQuiz, closeQuiz, startQuizAttempt, submitQuizAttempt
│       └── auditLogger.ts                   # Değiştirilemez siber güvenlik loglama servisi
├── firestore.rules                          # Firestore Güvenlik Kuralları
├── storage.rules                            # Cloud Storage Güvenlik Kuralları
├── firebase.json                            # Firebase yapılandırma dosyası
└── Plan.MD                                  # Bu mimari ve uygulama planı
```

---

## 8. Uygulama Yol Haritası ve Tamamlanan Fazlar

### Faz 1: Temel Altyapı, Tasarım Sistemi (`index.css`) ve Sıfır Sızıntılı Firebase Kurulumu (Tamamlandı)
- [x] **Adım 1.1 (Proje Kurulumu):** Next.js + TypeScript projesinin ve bağımlılıklarının yapılandırılması.
- [x] **Adım 1.2 (Tasarım Sistemi Temeli — `src/styles/index.css`):** Vanilla CSS tasarım sisteminin (`Plus Jakarta Sans` ve `JetBrains Mono` `tabular-nums`, HSL klinik renk tokenları) oluşturulması.
- [x] **Adım 1.3 (Firebase & Güvenlik Kuralları):** `firebase.json`, `firestore.rules` ve `storage.rules` dosyalarının oluşturulması; kimlik bilgilerinin kaynak koddan ve kullanıcı ekranlarından tamamen izole edilerek `.env.local` üzerinden okunması (`src/lib/firebase/client.ts`, `src/lib/firebase/admin.ts`).
- [x] **Adım 1.4 (Kapalı Devre Auth & Kesin Rol Ayrımı):** `/login`, `/register`, `/pending` akışının, `ClinicSessionContext` ile Firebase Custom Claims tabanlı rol ayrımının (istemci tarafı rol değiştirme butonu olmadan) ve 15 dk hareketsizlik kilidinin (`SessionGuard`) kodlanması.

### Faz 2: Pediatri Hesaplama Uygulamaları Sayfası (`/calculators`) — (Yer Tutucu Mimari Tamamlandı)
- [x] **Adım 2.1 (Yer Tutucu Katalog — `src/lib/pediatrics/index.ts`):** 5 ana pediatrik hesaplama grubu için girdi/çıktı ve güvenlik sınırı yer tutucularının oluşturulması *(Detaylı tıbbi formül motoru daha sonra kodlanacaktır)*.
- [x] **Adım 2.2 (`/calculators` Sayfası & Admin Protokol Yönetimi):** `/calculators` sayfasında 5 hesaplama modülünün yer tutucu kartlarının ve yalnızca `Admin` rolüne açılan protokol notu düzenleyicisinin entegre edilmesi.

### Faz 3: Eğitim Materyalleri Paylaşma ve Görüntüleme Sayfası (`/materials`) — (Tamamlandı)
- [x] **Adım 3.1:** `Admin` için materyal yükleme, bilim dalı/kıdem etiketleme ve indirme izni (`allowDownload`) yönetim arayüzünün yapılması (`src/components/materials/AdminMaterialManager.tsx`).
- [x] **Adım 3.2:** `User` için kategori filtreleme, okuma ilerleme takibi ve cihaz ID'si sızdırmayan **Dinamik Filigranlı (Hekim Adı + E-posta + Tarih/Saat)** uygulama içi materyal görüntüleyicinin (`src/components/materials/WatermarkedMaterialViewer.tsx`) kodlanması.

### Faz 4: Derslere Katılım Kontrolü — Admin Ders Başlatma & Katılım Log Dashboard'u (`/attendance`) — (Tamamlandı)
- [x] **Adım 4.1 (Admin Ders Başlatma & Canlı Projektör):** Yoklama alınacak dersin yalnızca `Admin` tarafından süre belirlenerek başlatılması (`startLectureSession`), 15 saniyede bir kriptografik olarak yenilenen projektör kodunun yansıtılması (`getProjectorCode`) ve dersin kapatılması (`endLectureSession`).
- [x] **Adım 4.2 (User Kişisel Yoklama & Geçmiş):** `User` için yalnızca aktif ders varken açılan kişisel cihaz + biyometrik doğrulamalı yoklama ekranı (`verifyRealTimeAttendance`) ve hekimin kendi katılım geçmişi tablosu (`src/components/attendance/DoctorRealTimeCheckIn.tsx`).
- [x] **Adım 4.3 (Admin Ders ve Katılımcı Bazlı Log Dashboard'u):** Admin için hem **Ders Bazlı** hem de **Katılımcı (Hekim) Bazlı** katılım loglarını, katılım yüzdelerini ve mazeret durumlarını gösteren ve CSV olarak dışa aktaran analitik dashboard'un tamamlanması (`src/components/attendance/AdminLiveAttendanceProjector.tsx`).

### Faz 5: Online Quiz — CSV ile Sınav Yükleme/Önizleme/Süre Belirleme ve Log Dashboard'ları (`/quizzes`) — (Tamamlandı)
- [x] **Adım 5.1 (Admin 9 Sütunlu CSV Yükleme, Önizleme, Süre Belirleme ve Yayına Alma):** Admin'in mevcut 9 sütunlu sınav yapısına uygun `.csv` dosyasını yüklemesi (`parseNineFieldQuizCsv`), satır bazlı doğrulama, sınavı önizleme, sınav süresini (dk) belirleme ve yayına alma (`saveQuizDraft`, `publishQuiz`) ile eski sınav sorularını otomatik olarak `quiz_question_archive` koleksiyonuna arşivleme akışının kodlanması (`src/components/quizzes/AdminQuizStudio.tsx`).
- [x] **Adım 5.2 (User Sadece Sınava Katılma ve Eski/Şimdiki Sınav Logları Dashboard'u):** `User` tarafında tüm Admin yetkilerinin kaldırılarak hekimin yalnızca aktif sınava katılması (`ClinicalExamRunner`), anında `Feedback_Text` karnesini görmesi (`InstantFeedbackReport`) ve eski + şimdiki sınavlarının loglarını kişisel dashboard'unda (`DoctorGrowthDashboard`) takip etmesi.
- [x] **Adım 5.3 (Admin Tüm Kullanıcı ve Sınav Logları Dashboard'u):** Admin'in tüm kullanıcıların ve tüm sınavların girişim loglarını, hekim bazlı özetleri ve sınav bazlı özetleri filtreleyip CSV olarak indirebildiği merkezi dashboard'un (`src/components/quizzes/AdminCentralAnalytics.tsx`) tamamlanması.

### Faz 6: Admin Güvenlik Paneli, Sıfır Sızıntı Denetimi ve Doğrulama Testleri (`/admin`) — (Tamamlandı)
- [x] **Adım 6.1:** `/admin` sayfasında bekleyen üyelik onayları, rol/kıdem atama, cihaz bağı sıfırlama ve değiştirilemez `audit_logs` izleme ekranının hiçbir Firebase proje kimliği veya anahtar sızdırmadan tamamlanması (`src/app/(protected)/admin/page.tsx`).
- [x] **Adım 6.2:** Tüm kaynak kodda kimlik bilgisi sızıntısı taramasının, 9 sütunlu CSV ayrıştırıcı/önizleme testlerinin, Admin ders başlatma & yoklama doğrulama testlerinin ve Firestore güvenlik kuralları testlerinin (`tests/verify-platform.mjs`) çalıştırılarak doğrulanması.

