# Dış denetim değerlendirmesi (2026-11-14)

Kullanıcının yaptırdığı dış denetim 19 bulgu verdi. Her bulgu kodla (dosya:satır) ve gerektiğinde resmî belgelerle
karşılaştırıldı. Bu belge her bulgu için hükmü ve gerekçesini kaydeder. Doğrulanan bulgular **F13** adımlarında
düzeltildi (`REVISION_PLAN.md` §1 ve §5 F13).

> Not: Denetimdeki satır numaraları F12.1 sonrasındaki koda aittir (ör. `DoctorCheckIn.tsx:65`, `live.ts:87`).

## Özet

- **Doğru ve kod değişikliği gerektiren:** 5, 6. Bunlar gerçekten P0.
- **Doğru ama önemi abartılmış:** 7, 8b, 10, 13, 14, 17, 18, 19.
- **Doğru ama zaten belgelenmiş operasyon adımı:** 1, 3, 16. Kod hatası değil.
- **Kısmen yanlış:**
  - 2: "requireMfa:false yapın" önerisi D20'yi ve DEPLOY.md'yi ihlal ediyor.
  - 4: `bootstrapFirstAdmin` diye bir fonksiyon yok.
- **Yanlış:**
  - 9: `registerPerIpPerHour` diye bir sabit yok.
  - 11: sunucu `deadline-exceeded` hatası vermiyor.
  - 15: 500 yazım sınırı 2023'te kaldırıldı.
  - 8a: bulgunun anlattığı veri kaybı oluşmuyor.
- **Ürün kararı:** 12. Bu konudaki karar D8'de kayıtlı.

## Bulgu bulgu hüküm

Simgeler: ✔ doğru · ◐ kısmen doğru · ✘ yanlış · — ürün kararı

| # | Hüküm | Gerekçe (kanıt) |
|---|---|---|
| 1 | ✔ doğru, zaten belgeli | `DEPLOY.md` §1.3 ve §2 tuzun tanımlanmasını zorunlu kılıyor. "32+ bayt" şartı yok: belge en az 16 karakter istiyor, `openssl rand -hex 32` de 64 karakter üretiyor. Bu bir kod hatası değil, dağıtım adımı. |
| 2 | ◐ yarısı doğru | TOTP açılmazsa kilitlenme olur; bu doğru ve `DEPLOY.md` §1.1.3'te anlatılıyor. Ancak **"config/security requireMfa:false oluşturun" önerisine katılmıyorum.** `DEPLOY.md` §1.2 bu dokümanı açıkça yasaklıyor ve D20'ye göre canlıda `false` görülmesi bir güvenlik olayı. |
| 3 | ✔ doğru, zaten belgeli | `DEPLOY.md` §1.1.7 bu adımı içeriyor. Tek eksik: `cors.json` depoda yok, yalnızca belgenin içinde yazılı. |
| 4 | ◐ yarısı yanlış | IAM izni gerçek bir gereksinim. Bu izin CLI istemiyle veriliyor (§1.1.6). **`bootstrapFirstAdmin` adında bir fonksiyon kod tabanında yok.** İlk admin konsoldan atanıyor (§1.4). Bulgunun bu kısmı uydurma. |
| 5 | ✔✔ **doğru, gerçek P0** | `layout.tsx:71` MFA'sız üyeyi `/account/security`'ye yönlendiriyor. Ama `SessionGuard.tsx:58` önce ConsentGate'i gösteriyor. `acceptConsent` ise `"member"` erişimiyle tanımlı → `requireActive` → `guards.ts:87` ikinci faktör istiyor. Sonuç: çıkışı olmayan bir kilitlenme. Tetikleyici zaten oluştu: F12.1 ile KVKK metni 1.2'ye çıktı ve her üyeden yeniden onay isteniyor. MFA kurmamış her yeni onaylı üye bu döngüye girer. Önerilen iki çözümden **istemci sırasını değiştirmeyi** seçiyorum. Sunucu bekçisini gevşetmek kural 3'e ve güvenlik ilkesine aykırı. |
| 6 | ✔ **doğru** | `securityHeaders.ts:66-74` içinde `connect-src` reCAPTCHA'yı içermiyor. Google'ın resmî reCAPTCHA SSS'si `connect-src https://www.google.com/recaptcha/` istiyor. Emülatör debug sağlayıcı kullandığı için e2e bunu yakalayamaz. `gstatic` için connect-src izni resmî listede yok, gereksiz. |
| 7 | ✔ doğru, ama P2 | `isLectureOpen` yalnızca render anında değerlendiriliyor. Countdown kendi state'ini tuttuğu için üst bileşen yeniden çizilmiyor, bu yüzden form ≤5 dk açık kalıyor. Sunucu süresi dolmuş katılımı reddediyor (`attendanceService.ts:261`), yani veri hatası oluşmuyor. Kiosk ise her 15 sn yeniden çizildiği için bu sorunu yaşamıyor. |
| 8a | ✘ öne sürülen etki yok | `submitQuizAttempt` tam `responsesRef.current`'i gönderiyor. Taslak kaydı ve teslim aynı attempt üzerinde transaction'la çalışıyor ve `in_progress` ön koşulunu kontrol ediyor (`quizService.ts:524,562`). Yani veri kaybı olmaz; en kötü durumda kısa süreli sahte bir "Kaydedilemedi" hatası görünür. |
| 8b | ✔ doğru, P2 | `disabled={expired}` olduğu için tekrar deneme yolu yok. Zamanlayıcı yalnızca kaydedilmiş taslağı puanlıyor. Bu yüzden son ≤3 sn'lik yanıt, 30 sn'lik tolerans (`QUIZ_SUBMIT_GRACE_MS`) içinde yeniden denenebilmeli. |
| 9 | ✘ **yanlış** | `registerPerIpPerHour` diye bir şey yok. Kayıt sınırı **üye başına** uygulanıyor (5/dk, `rateLimit.ts:17`), IP başına değil. Gerçek IP sınırı Identity Platform'un kendi hesap oluşturma kotası; o da bulgudaki 10/saatten çok daha yüksek. |
| 10 | ◐ doğru, P2 | Yoklama ekranlarında saat farkı düzeltmesi yok (sınav ekranında var: `DoctorQuizzes.tsx:46`). Gerçekçi risk projektör PC'si; telefonlar NTP ile senkron. Bulgudaki `status === 'open'` önerisi yanlış, durum değeri `"live"`. |
| 11 | ✘ **yanlış** | Mevcut `in_progress` girişimde `startQuizAttempt` hata vermiyor, girişimi geçmiş deadline ile döndürüyor (`quizService.ts:457-465`). QuizExam açılınca Countdown hemen `onExpire` tetikliyor, teslim geç sayılıyor ve kaydedilmiş yanıtlar puanlanıyor. Önerilen `finalizeOnTimeout` parametresi de yok. Kalan tek sorun kozmetik: soru ekranı bir an görünüp kayboluyor. |
| 12 | — ürün kararı | D8 bunu bilinçli olarak kapsam dışı bırakıyor; sayfa dürüst bir "Yakında" mesajı gösteriyor. Menü adını değiştirmek makul bir UX önerisi ama hata değil. |
| 13 | ◐ yön doğru, senaryo yanlış | Firestore web SDK'sı aynı istemciden gelen yazımları gönderildiği sırayla uygular. Bu yüzden "completed:false sonradan yazılır" senaryosu oluşmaz. Asıl hata başka: eşzamanlı iki `flush` aynı eski `savedRef`'ten hesap yapıyor ve ikinci yazım ilkinin saniyelerini kaybediyor. Okuma süresi eksik sayılıyor (P3). Önerilen çözüm (`createSaveQueue`) yine de doğru. |
| 14 | ✔ doğru, P3 | (a) `ClinicSessionContext.tsx:115-152`: async snapshot geri çağrısı, abonelik değiştikten sonra eski oturumla `setState` yapabiliyor. (b) Faktör listesi yalnızca `mfaEnrolled` değişince yenileniyor. Bu yalnızca MFA zorunlu değilken ve birden çok faktör varken görülür. Canlıda "Kaldır" butonu zaten görünmüyor. |
| 15 | ✘ **yanlış (eski bilgi)** | Firestore 24 Mart 2023'te transaction ve commit başına 500 yazım sınırını kaldırdı. Geçerli sınırlar 10 MiB istek boyutu ve 270 sn. Önerilen 200'lük parçalara bölme ders kapanışının atomikliğini (D22) bozar, yani zararlı. |
| 16 | ✔ doğru, zaten devir notunda | Bu bir hukuk süreci adımı. Dikkat: metin onay sırasında değişirse sürüm artar ve 5. madde tetiklenir. 5. madde önce düzeltilmeli. |
| 17 | ◐ doğru, P3 | Kart başına bir dinleyici açılıyor. Firestore bunları tek bağlantıda çoğulluyor, okuma maliyeti de bir sorguyla aynı. Ancak 100+ dinleyici önerilen sınırın üstüne çıkar. Klinik ölçeğinde şimdilik ertelenebilir. |
| 18 | ✔ doğru, P3 | `AuditLog.tsx:47-63` içinde iptal bayrağı yok. Hızlı filtre değişiminde eski yanıt yeni sonuçların üzerine yazabilir. |
| 19 | ✔ doğru | `src/` ve `functions/src/` içinde `collectionGroup` kullanılmıyor; admin raporu tek materyalin alt koleksiyonunu okuyor. Kuralı yalnızca bir rules testi kullanıyor. `{path=**}` kalıbı gelecekteki her `progress` koleksiyonuyla eşleşeceği için kaldırılmalı. |

## Düzeltmeler

| Adım | Bulgular |
|---|---|
| F13.1 | #5 (onay ↔ MFA kilitlenmesi), #6 (CSP reCAPTCHA `connect-src`) |
| F13.2 | #7 (süre dolunca yoklama ekranı), #10 (projektörde sunucu saati) |
| F13.3 | #8b (süre bitiminde "Tekrar dene"), #11 (süresi geçmiş girişimde ekran) |
| F13.4 | #13 (materyal ilerleme kuyruğu), #14 (oturum bağlamı yarışı, faktör listesi), #18 (denetim kaydı süzgeci) |
| F13.5 | #19 (collectionGroup kuralı), #3 (`cors.json` şablonu) |

**Yapılmayanlar:**

- 1, 2, 3 (kod kısmı), 4, 16: operasyon veya hukuk adımları; `DEPLOY.md` ve devir notunda zaten var.
  2'deki `requireMfa:false` önerisi uygulanmaz (D20).
- 9, 15: bulgu yanlış. 15'teki parçalama önerisi ders kapanışının atomikliğini (D22) bozar.
- 12: D8; menü adını değiştirmek kullanıcı kararı.
- 17: klinik ölçeğinde gereksiz; gerekirse `collectionGroup('progress').where('uid', '==', me)` ile çözülür.

## Kaynaklar

- reCAPTCHA CSP listesi (`connect-src https://www.google.com/recaptcha/`): https://developers.google.com/recaptcha/docs/faq
- Firestore, 24 Mart 2023: commit/transaction başına 500 yazım sınırı kaldırıldı: https://docs.cloud.google.com/firestore/docs/release-notes
- Firestore sınırları (10 MiB istek, 270 sn transaction): https://docs.cloud.google.com/firestore/quotas
