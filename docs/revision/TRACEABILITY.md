# Denetim İzlenebilirliği (F10.4)

[`AUDIT.md`](AUDIT.md) içindeki her bulgunun hangi adımla kapandığı ve kanıtı. Adım numaraları
[`REVISION_PLAN.md`](REVISION_PLAN.md) §1'deki ilerleme tablosuna, kararlar (D…) aynı belgenin §3'üne gider.

**Durum işaretleri**

- ✅ **Kapandı:** bulgu giderildi ve otomatik testle kanıtlı.
- 🟡 **Kısmen:** bulgunun özü giderildi; önerinin bir parçası bilinçli olarak yapılmadı (gerekçesi "Not"ta).
- ⬜ **Kapanmadı:** yapılmadı; gerekçesi ve sahibi "Not"ta.
- 🔎 işareti: kod ve otomatik test tamam, ama gerçek ortamda/cihazda doğrulama gerekiyor
  ([`UAT_SCENARIOS.md`](UAT_SCENARIOS.md), [`STAGING_CHECKLIST.md`](STAGING_CHECKLIST.md)).

**Kanıt yazımı:** `dosya › "test adı"`. Dizinler: `e2e/` (Playwright; masaüstü ve telefon), `tests/unit/`,
`tests/rules/`, `functions/test/`. Test adları kısaltılmış olabilir; hepsi depoda aranabilir. Bütün paketlerin
yeşil olduğu CI çalışması: [#57](https://github.com/hansero/pediatrist/actions/runs/43108681873).

**Özet:** 81 bulgunun 72'si kapandı, 8'i kısmen kapandı, 1'i kapanmadı. Kapananların 8'i ayrıca gerçek ortamda
doğrulanmalıdır (🔎). Kapanmayan ve kısmen kalanlar ile kapanan bulgulardan artakalan iyileştirmeler
[sondaki listede](#açık-kalanlar) toplanmıştır.

---

## 1. Kritik bulgular

| Bulgu | Durum | Adım | Kanıt | Not |
| --- | --- | --- | --- | --- |
| **C1** Sessiz fallback sahte başarı üretiyor | ✅ | F1.4, F4–F7, F7.5 | `tests/unit/callables.test.ts › "yapılandırma yoksa sahte yanıt üretmez, 'not-configured' fırlatır"`; `tests/unit/useAsyncAction.test.ts › "…sonuç gelmeden başarı göstermez"`; `tests/unit/ui/ConfirmDialog.test.tsx › "…başarıda kapanır (iyimser başarı yok)"`; CI adımı "No-mock guard" | `invokeWithFallback` silindi; sahte veri bekçisi istisnasız. |
| **C2** Yoklama uçtan uca çalışmıyor | ✅ 🔎 | F4.1–F4.6 | `e2e/attendance.spec.ts › "ders başlat → projektör kodu → hekim QR bağlantısıyla katılır → canlı liste → mazeret → dersi bitir"`, `"yanlış kod ve süresi geçmiş kod reddedilir…"`; `functions/test/attendance.test.ts` (31 test); `tests/unit/schemas.test.ts › "yalnızca ders ve kodu taşır…"` | Sahte tarama, simülasyon seçeneği ve "biyometrik" kutusu kaldırıldı. Gerçek telefon: UAT B1–B4. |
| **C3** Sınav mock; cevap anahtarı istemci paketinde | ✅ | F5.1–F5.5 | `functions/test/quiz.test.ts › "sorular yalnızca girişimle gelir (cevap anahtarı yok)…"`, `"teslim: sunucu puanlar; girişime doğru cevap/feedback YAZILMAZ…"`; `e2e/quiz-exam.spec.ts` (2 test); `e2e/quiz-admin.spec.ts` (3 test) | İstemcide puanlama ve uydurma karne silindi. |
| **C4** İki aşamalı doğrulama sahte | ✅ 🔎 | F3.4, N8 | `tests/unit/auth/mfa.test.ts › "kod Identity Platform'a gönderilir (istemci kendisi doğrulamaz)"`; `tests/unit/auth/LoginPage.test.tsx › "MFA: ikinci adım açılır…"`; `tests/rules/firestore.test.ts › "zorunluyken ikinci faktörsüz oturum veri okuyamaz…"`; `functions/test/guards.test.ts › "MFA zorunluysa (config/security) ikinci faktörsüz oturum reddedilir"`; `e2e/auth.spec.ts › "doğru şifre: doğrudan panel; sahte 6 hane adımı yok"` | Auth emülatörü TOTP'yi desteklemiyor; gerçek kurulum ve giriş UAT A4. |
| **C5** Askıdaki / yetkisi düşen üye 1 saat erişiyor; yetki kaynakları çelişiyor | ✅ | F2.1–F2.4, D3 | `tests/rules/firestore.test.ts › "C5: askıya alınmış üye, eski 'active' claim'li token'la materyal okuyamaz"`; `tests/rules/storage.test.ts › "C5 (Storage): …"`; `functions/test/guards.test.ts › "C5: …"`; `tests/unit/sessionDecision.test.ts` (8 test); `e2e/session.spec.ts` | Tek kaynak `users/{uid}`; `tokensValidAfter` ile anında iptal. |
| **C6** CSP arka ucu engelliyor; iki kopya | ✅ | F2.5, D9 | `tests/unit/securityHeaders.test.ts` (12 test; ör. `"callable istekleri yalnızca bu projenin bölgesel uç noktasına gider"`, `"Hosting'de başlık kopyası yok…"`); `e2e/csp.spec.ts` (2 test); her e2e testinde CSP bekçisi | Kalan iyileştirme: `script-src 'unsafe-inline'` duruyor (nonce yapılmadı; gerekçe `config/securityHeaders.ts` yorumunda). Açık kalanlar listesinde. |
| **C7** Sınav süresi atlatılabiliyor; cevap anahtarı sınav sürerken sızıyor | ✅ | F2.1, F5.1, D7 | `tests/rules/firestore.test.ts › "C7: asistan yayındaki sınavın sorularını doğrudan okuyamaz…"`; `functions/test/quiz.test.ts › "after_close: kapanışta süresi süren meslektaş varken karne açılmaz; son girişimin süresi dolunca açılır"`; `e2e/quiz-exam.spec.ts › "after_close: …teslimde doğru cevaplar kapalı; kapanınca karne açılır"` | |
| **C8** Hareketsizlik kilidi sınavı ve projektörü öldürüyor | ✅ | F3.3, F4.3, F5.3 | `tests/unit/auth/IdleContext.test.tsx › "muafiyet (sınav/projektör) sürerken uyarı ve çıkış yok…"`; `tests/unit/auth/SessionGuard.test.tsx › "uyarı diyalogu: 14. dakikada…"`; `e2e/idle.spec.ts`; `e2e/quiz-exam.spec.ts` (yanıtlar sunucuda, yenilemede devam) | Projektörde ekranı açık tutma (Wake Lock) ve tam ekran var; salonda doğrulama UAT B2. |
| **C9** Kayıt ve kabul akışı | ✅ 🔎 | F2.3, F3.5, D4 | `functions/test/members.test.ts › "davetsiz kayıt: …rol/durum istemciden alınmaz"`, `"geçerli davet: doğrudan aktif…"`; `tests/rules/firestore.test.ts › "istemci, eski kayıt ekranının geçerli biçimiyle bile profil oluşturamaz (D4)"`, `"C9: asistan davet kodlarını okuyamaz; admin okur"`; `e2e/registration.spec.ts` (7 test); `e2e/auth.spec.ts › "şifremi unuttum: …"` | Gerçek e-posta gönderimi: UAT A3, A5. |
| **C10** Dashboard ve admin paneli uydurma veri gösteriyor | ✅ | F7.1–F7.3 | `e2e/dashboard.spec.ts` (2 test); `e2e/admin-panel.spec.ts` (3 test); `tests/unit/dashboard/next-step.test.ts` (8 test); `tests/rules/firestore.test.ts › "hiçbir istemci (admin dahil) denetim kaydı yazamaz; yalnızca admin okur"` | |
| **C11** Materyal modülünde dosya işleme yok | ✅ 🔎 | F6.1–F6.4, D19 | `functions/test/materials.test.ts` (6 test); `tests/rules/storage.test.ts › "C11: admin materyal dosyasını silebilir; asistan silemez"`; `e2e/materials-admin.spec.ts` (2 test); `e2e/materials-viewer.spec.ts` | Sunumlar PDF olarak yüklenir (pptx reddedilir). Gerçek Storage'dan PDF (CORS): UAT D2. |

## 2. Güvenlik ve veri bütünlüğü

| Bulgu | Durum | Adım | Kanıt | Not |
| --- | --- | --- | --- | --- |
| **S1** Cihaz bağlama `localStorage` sırrına dayanıyor | ✅ | F4.2 → F11.1, D23 | `localStorage` sırrı F4.2'de kalktı; passkey ile cihaz bağlama F11.1'de kullanıcı kararıyla tamamen kaldırıldı. `tests/unit/schemas.test.ts › "yalnızca ders ve kodu taşır…"`; `functions/test/attendance.test.ts › "MFA zorunluyken ikinci faktörsüz oturum yoklama veremez…"` | Kimlik MFA'lı oturumdan gelir. Bulgudaki kök neden (tarayıcıda tutulan sır) artık yok. Cihaz bağlama olmadığı için hesabı açık bir telefondan yoklama verilebilir; kabul edilen risk (D23). |
| **S2** Kod iletilebilir; yakınlık kanıtı yok | 🟡 | F9.2 | `functions/test/attendance.test.ts › "projektörle aynı ağdan katılım işaretlenmez; farklı ağdan katılım kaydedilir ama denetim kaydında işaretlenir"`; `functions/test/operations.test.ts › "projektör ekranının ağ özeti gizli dokümanda tutulur…"` | Önerinin "en azından işaretle" kısmı yapıldı. Konum (geofence) ya da salon içi ikinci etken **yapılmadı**: katılım engellenmez, yalnızca işaretlenir. Kod penceresi 15 sn + bir önceki pencere. F11.1'de cihaz bağlama kaldırıldı (D23); bu risk passkey döneminde de aynıydı (devamsız hekim kendi hesabıyla iletilen kodu girebilir). |
| **S3** Yoklama yazımları transaction değil; sayaçlar bozuluyor | ✅ | F4.1 | `functions/test/attendance.test.ts › "aynı imzayla eşzamanlı iki istek: biri kaydedilir…; sayaç 1"`, `"mazeretli → katıldı: katılan +1, mazeretli −1"`, `"tekrar mazeret: sayaç artmaz…"` | |
| **S4** Tek canlı ders denetimi yarışlı; süresi dolan ders açık kalıyor | ✅ | F4.1, F5.1 | `functions/test/attendance.test.ts › "eşzamanlı iki ders başlatma isteğinden yalnızca biri geçer (kilit)"`, `"closeExpiredLectures: süresi dolanı kapatır…"`, `"süresi dolmuş derste kod üretilmez ve yoklama alınmaz"`; `functions/test/quiz.test.ts › "kapanış zamanı: …zamanlayıcı sınavı kapatır"` | |
| **S5** `endLectureSession` varlık/durum denetlemiyor | ✅ | F4.1 | `functions/test/attendance.test.ts › "bitirme: olmayan ders not-found; ikinci bitirme failed-precondition…"` | |
| **S6** Çift teslim yeniden puanlıyor | ✅ | F5.1, F5.3 | `functions/test/quiz.test.ts › "çift teslim: eşzamanlı iki istekten biri geçer; sonraki teslim reddedilir"`; `tests/unit/useAsyncAction.test.ts › "çift tıklamada ikinci çağrıyı yok sayar"` | |
| **S7** Girişim sürerken yayın/kapanış soruları erişilmez kılıyor | ✅ | F5.1, F5.2 | `functions/test/quiz.test.ts › "devam eden girişim varken yeni yayın onay ister; force ile yayınlanır, devam eden teslim edebilir"`; `e2e/quiz-admin.spec.ts › "taslak → düzenle → yayınla → sınavda hekim varken yeni yayın onayı → …"` | |
| **S8** Girdi tipleri sunucuda doğrulanmıyor | ✅ | F1.1–F1.3 | `tests/unit/schemas.test.ts` (17 test; ör. `"sayı yerine metin gelen başlığı reddeder…"`); `functions/test/guards.test.ts › "yetkili kullanıcının geçersiz verisi Türkçe 'invalid-argument' döner"` | Ortak zod şemaları (`@shared/schemas`). |
| **S9** Kendi yetkisini düşürme, son admin, olmayan uid | ✅ | F2.3 | `functions/test/members.test.ts › "admin kendi rolünü veya durumunu değiştiremez"`, `"iki admin birbirini aynı anda düşürmeye çalışırsa yalnızca biri başarılı olur"`, `"Auth'ta veya profilde olmayan kullanıcı için profil oluşturmaz"` | |
| **S10** Denetim kaydı en-iyi-çaba; IP/tarayıcı yok; saklama yok; kayıt seli | 🟡 | F1.3, F9.2 | `functions/test/operations.test.ts › "her kayıt expireAt (varsayılan 2 yıl), ağ özeti ve tarayıcı bilgisi taşır; ham IP yazılmaz"`, `"pencere içinde sınır kadar isteğe izin verir; fazlası reddedilir ve pencere başına tek denetim kaydı düşer"`, `"üye silme: işaretli hata satırı yazılır…"` | Aynı batch/transaction, tuzlu IP özeti, TTL ve hız sınırı yapıldı. **Yapılmadı:** BigQuery dışa aktarımı (yalnızca kritik olaylar Cloud Logging'e düşer) ve App Check tek kullanımlık belirteçleri. TTL ve tuz 🔎 staging'de. |
| **S11** `users` oluşturma kuralı keyfî alana izin veriyor | ✅ | F2.1, D4 | `tests/rules/firestore.test.ts › "kendini admin/aktif kaydetme girişimleri de reddedilir"`, `"hiç kimse (admin dahil) profil güncelleyemez…"` | İstemci hiç profil yazamaz. |
| **S12** `progress` şemasız; bekleyen üye yazabiliyor | ✅ | F2.1, F6.1 | `tests/rules/firestore.test.ts › "ek alan, yanlış tip, negatif süre veya istemci zamanı reddedilir"`, `"başkası adına yazamaz…; bekleyen kullanıcı yazamaz"`, `"MFA'sız oturum kendi okuma ilerlemesini de yazamaz"` | |
| **S13** İstemci tarafı "DRM" yalnızca caydırıcı | 🟡 | F6.3, D11 | `tests/unit/materials/doctor.test.ts › "filigran: ad, e-posta, zaman"`; `e2e/materials-viewer.spec.ts` (filigran canvas'a yakılı) | Etiket "filigranlı görüntüleme" oldu; filigran sayfa görüntüsüne yakılıyor. **Yapılmadı:** sunucuda sayfa görüntüsü üretme ve kısa ömürlü imzalı adres. Dosyaya erişimi olan üye özgün dosyayı tarayıcı araçlarıyla alabilir. |
| **S14** Lockfile yok; yamalı sürümler | 🟡 | F0.1, D15, D16 | İki `package-lock.json` depoda; CI `npm ci` kullanır | Yüksek seviyeli `npm audit` bulguları kapatıldı; kalan orta seviye `uuid` zinciri kabul edilmiş risk (D15). **Yapılmadı:** otomatik bağımlılık denetimi (Dependabot / CI'da `npm audit`). |
| **S15** `measurementId` var, Analytics yok | ✅ | F0.3 | `src/` ve `.env.example` içinde `measurementId` geçmiyor | Analytics kullanılmıyor; rıza gerekmez. |

## 3. Kullanılabilirlik

| Bulgu | Durum | Adım | Kanıt | Not |
| --- | --- | --- | --- | --- |
| Mutasyonlar beklemeden "başarılı" diyor; yükleniyor durumu yok | ✅ | F1.4, F3.1 | C1 kanıtları; `tests/unit/ui/Button.test.tsx › "yüklenirken: aria-busy + aria-disabled…"` | |
| Bekleme/askı ekranında çıkış yok, jargon var, kendiliğinden açılmıyor | ✅ | F2.4, F3.5 | `tests/unit/auth/SessionGuard.test.tsx › "onay bekleyen üye içerik görmez; çıkış yapabilir…"`; `e2e/session.spec.ts › "onay → canlı aktifleşme; …askıya alma → oturum kapanır"` | |
| Yıkıcı/yetki veren admin işlemlerinde onay yok; "onayla" askıdakine de gösteriliyor | ✅ | F7.1 | `e2e/admin-panel.spec.ts › "üye yaşam döngüsü: onay → eğitim sorumlusu (adı yazarak) → …"`; `tests/unit/admin/members.test.ts › "onayla (bekleyen) ve yeniden etkinleştir (askıdaki) ayrı…"` | |
| Sınav: ayrılma onaysız; süre sunucudan değil; uyarı yok | ✅ | F5.3 | `tests/unit/ui/Countdown.test.tsx › "…sunucu bitiş anından hesaplar ve saat farkını düzeltir"`, `"eşiklerde kibar duyuru…"`; `e2e/quiz-exam.spec.ts › "immediate: sınavdan ayrılıp dönülür…"`; `e2e/quiz-timeout.spec.ts` | |
| Sınav görselleri gösterilmiyor | ✅ | F5.2, F5.3 | `e2e/quiz-exam.spec.ts` (görsel `<img>` ve büyütme); `e2e/quiz-admin.spec.ts › "stüdyo: …görsel yükleme, CSV hataları ve eksik görsel engeli"` | |
| Hekim sınav panosu her zaman "katıl" diyor | ✅ | F5.3 | `tests/unit/quiz/doctor.test.ts › "süre + tolerans dolmadıysa döner; teslim edilmiş veya süresi geçmiş dönmez"`; `e2e/quiz-exam.spec.ts` (Başlanmadı → devam → karne) | |
| Materyal: varsayılan süzgeç, kategori uyumsuzluğu, kendi beyanıyla "tamamlandı" | ✅ | F6.3 | `tests/unit/materials/doctor.test.ts › "tamamlanabilirlik: PDF son sayfa, video %90, görsel hemen"`, `"süzgeç: kıdem ve kategori"`; `e2e/materials-viewer.spec.ts` | |
| Giriş: şifremi unuttum, otomatik doldurma, şifre politikası | ✅ 🔎 | F3.4, F3.5 | `e2e/auth.spec.ts › "şifremi unuttum: …kayıtsız adres için aynı nötr mesaj"`; `tests/unit/auth/LoginPage.test.tsx › "…tarayıcı otomatik doldurma öznitelikleri"`; `tests/unit/auth/password.test.ts`; `e2e/registration.spec.ts › "KVKK onayı ve şifre tekrarı olmadan başvuru gönderilmez…"` | Sunucu tarafı şifre politikası konsolda ayarlanır (kontrol listesi A5). |
| Gezinme tam sayfa yeniliyor; aktif durum yok | ✅ | F3.2 | `e2e/nav.spec.ts › "menüden geçiş sayfayı yeniden yüklemez; aktif sayfa işaretlenir"`; `tests/unit/nav/AppShell.test.tsx` (7 test) | |
| Mobil: kenar çubuğu içeriğin üstünde | ✅ | F3.2 | `e2e/nav.spec.ts › "telefon: kenar çubuğu yerine çekmece…"`; bütün e2e senaryoları telefon projesinde de koşar ve yatay taşmayı denetler | |
| Yoklama girişi: klavye öznitelikleri; QR birincil yol değil | ✅ | F4.4 | `tests/unit/attendance/attendance.test.ts › "dersi ve kodu sorgu parametresi olarak taşır, köken korunur"`; `e2e/attendance.spec.ts` (QR bağlantısıyla gelen kod dolu) | |
| Projektör kodu küçük; tam ekran ve QR yok; süre sınırı tutarsız | ✅ 🔎 | F4.3 | `e2e/attendance.spec.ts` (QR görünür; kod tek satıra sığar); `tests/unit/schemas.test.ts › "süre sınırını ortak LIMITS'ten alır (1–240)"` | Salonun arkasından okunabilirlik: UAT B2. |
| Yoklama listesi sabit üç kişi; payda yanlış | ✅ | F4.1, F4.3, D22 | `functions/test/attendance.test.ts › "beklenen katılımcılar: dersin başladığı andaki etkin hekimler…"`, `"dersi bitirince beklenen ama kaydı olmayan hekime absent kaydı…"` | |
| Sınav analitiği ada göre grupluyor | ✅ | F5.4 | `tests/unit/quiz/analytics.test.ts › "hekim gruplaması kimliğe göre: aynı ad karışmaz, ad değişse bölünmez…"` | |
| Hesaplayıcılar "yer tutucu" ama güvenlik kilidi etkin gibi | ✅ | F7.4, D8 | `e2e/calculators.spec.ts › "…çalışmayan özellik iddiası yok"`; `functions/test/calculators.test.ts` (2 test) | Formül motorunun kendisi kapsam dışı (aşağıda ⬜). |
| `not-found` / `error` / `loading` yok | ✅ | F3.2 | `e2e/nav.spec.ts › "bilinmeyen adres: Türkçe 404 sayfası ve geri dönüş bağlantısı"` | |

## 4. Görsel hiyerarşi

| Bulgu | Durum | Adım | Kanıt | Not |
| --- | --- | --- | --- | --- |
| İlk göze çarpan şey iç yönlendirme etiketleri ve uzun başlıklar | ✅ | F3.2–F7, F8.1 | Sayfalar yeniden yazıldı; e2e testleri kısa başlıkları doğrular (ör. "Üyeler ve güvenlik", "Sınav yönetimi") | Otomatik "jargon" testi yok; F8.1'de kaynak taramasıyla denetlendi. |
| Dashboard önceliksiz; sabit göstergeler | ✅ | F7.3 | `e2e/dashboard.spec.ts`; `tests/unit/dashboard/next-step.test.ts` | Tek birincil eylem. |
| Durum renkleri süs olarak kullanılıyor | ✅ | F3.1, F8.1 | `StatusChip` yalnızca durumlarda renkli (F8.1 taraması) | Otomatik test yok. |
| Düğme metinleri 6–10 kelime; jargon | ✅ | F8.1 | F8.1 taraması: bütün düğmeler 1–3 kelime | Otomatik test yok; anlaşılırlık UAT'de gözlenir. |
| Satır içi stiller yüzünden düzensiz boşluk | ✅ | F3.1 | Boşluk token'ları (`--space-*`); `tests/unit/ui/contrast.test.ts › "stil dosyalarında ve bileşenlerde tanımsız token kullanılmıyor"` | 5 satır içi stil kaldı; hepsi çalışma anında hesaplanan değer (animasyon süresi, ölçer genişliği, grafik) ya da genel hata sayfası. |

## 5. Tutarlılık

| Bulgu | Durum | Adım | Kanıt | Not |
| --- | --- | --- | --- | --- |
| Tanımsız CSS token'ları (`--status-warn`) | ✅ | F3.1 | `tests/unit/ui/contrast.test.ts › "stil dosyalarında ve bileşenlerde tanımsız token kullanılmıyor"` | |
| Uyarı sınıfı adları uyuşmuyor | ✅ | F3.1 | `tests/unit/ui/misc.test.tsx › "critical → role=alert; diğerleri → role=status…"` | Tek `Alert` / `StatusChip` bileşeni, tek ton sözlüğü. |
| Yüzlerce satır içi stil | ✅ | F3.1–F7 | Ortak primitifler (`components/ui`) | Kalan 5 satır yukarıda açıklandı. |
| Kullanılmayan CSS | ✅ | F8.2 | F8.2 taraması; 72 satır silindi | Otomatik test yok. |
| Google Fonts `@import` | ✅ | F3.1 | `next/font` (yazı tipleri kendi sunucudan); `tests/unit/securityHeaders.test.ts › "geliştirme ve emülatör istisnaları üretimde yok; geniş jokerler yok"` | |
| Alan sabitleri üç yerde tanımlı | ✅ | F1.1, D2 | `tests/unit/storageRulesSync.test.ts` (3 test); `@shared/constants` tek kaynak | |
| API sözleşmeleri uyuşmuyor; takma adlar | ✅ | F1.1–F1.4 | `tests/unit/schemas.test.ts › "functions/src/index.ts'ten dışa aktarılan her callable'ın bir sözleşmesi vardır"`, `"eski takma adları (dynamicCode, clientDeviceSecret) kabul etmez"`; `tests/unit/callables.test.ts › "sözleşmeye uymayan sunucu yanıtını 'bad-response' olarak reddeder"` | |
| Tipler arayüz bileşenlerinin içinde | ✅ | F1.1 | `functions/src/shared/types.ts`, `src/lib/auth/types.ts` | Typecheck CI adımı. |
| İki CSV dışa aktarımı; formül enjeksiyonu; ayırıcı | ✅ | F1.2 | `tests/unit/csv.test.ts` (6 test; ör. `"formül enjeksiyonuna karşı…"`, `"BOM ve ';' ayırıcı ile yazar…"`) | Excel'de açılış: UAT B5. |
| CSV doğrulaması istemci ile sunucuda farklı; başlık adları denetlenmiyor | ✅ | F1.2 | `tests/unit/quizParser.test.ts › "sütunlar yer değiştirmişse reddeder…"`; `functions/test/quiz.test.ts › "…geçersiz soru önizlemeyle aynı mesajla"` | Tek ortak doğrulayıcı. |
| Adlandırma: `onClinicMemberCreated`, `clinic_members` | ✅ | F2.1, F2.3 | `tests/rules/firestore.test.ts › "kaldırılan 'clinic_members' koleksiyonu kapalıdır"` | `syncUserClaims`. |

## 6. Erişilebilirlik

| Bulgu | Durum | Adım | Kanıt | Not |
| --- | --- | --- | --- | --- |
| Renk kontrastı (soluk metin, uyarı çipi, odak halkası, girdi kenarlığı) | ✅ | F3.1 | `tests/unit/ui/contrast.test.ts › "metin: … ≥ 4.5:1"`, `"kontrol/odak: … ≥ 3:1"`; `e2e/a11y.spec.ts` (axe) | |
| Dokunma hedefleri 28 px | ✅ | F3.1 | `(pointer: coarse)` kuralı: en az 44 px | Otomatik test yok; UAT F1. |
| Sekmeler ARIA'sız | ✅ | F3.1 | `tests/unit/ui/Tabs.test.tsx` (3 test) | |
| Etiketsiz kontroller | ✅ | F3.1, F8.1 | `e2e/a11y.spec.ts` (4 test: herkese açık, hekim, admin ve sekmeleri, bekleyen hesap); `tests/unit/ui/misc.test.tsx › "etiket kontrole bağlı…"` | axe: ciddi/kritik ihlal 0. |
| Sınav: fieldset/legend, soru düğmeleri, süre duyurusu | ✅ | F5.3, F10.4 | `e2e/quiz-exam.spec.ts` (sınav ekranı ve karne axe denetimi; "Soru n, yanıtlandı" düğmeleri); `tests/unit/ui/Countdown.test.tsx › "role=timer, erişilebilir ad…"` | Sınav ekranının axe denetimi bu adımda eklendi. |
| Diyaloglarda odak tuzağı yok | ✅ | F3.1 | `tests/unit/ui/ConfirmDialog.test.tsx` (5 test) | |
| Hatalar girdiye bağlı değil | ✅ | F3.1 | `tests/unit/ui/misc.test.tsx › "…hata varken aria-invalid ve aria-describedby"` | |
| `prefers-reduced-motion` yok | ✅ | F3.1 | Stil dosyalarında azaltılmış hareket kuralı | Otomatik test yok. |
| Görsellere alternatif metin | 🟡 | F5.3 | Görseller `alt="Soru n görseli"` ile çizilir | Görsel başına içerik açıklaması (CSV'ye 10. sütun) **yapılmadı**: ekran okuyucu kullanan hekim görselin içeriğini öğrenemez. |

## 7. Performans ve mimari

| Bulgu | Durum | Adım | Kanıt | Not |
| --- | --- | --- | --- | --- |
| Bütün uygulama istemci bileşeni; `firebase-admin` / `admin.ts` kullanılmıyor | 🟡 | F8.2 | `admin.ts` ve `server-only` silindi; `firebase-admin` yalnızca test verisi betiğinde | Uygulama istemci tarafında çizilmeye devam ediyor ve **sunucu tarafı sayfa koruması yok** (karar notu, F8.2): veriler kurallar ve Cloud Functions ile korunur. |
| Saniyelik zamanlayıcılar bütün sayfayı yeniden çiziyor | ✅ | F3.3, F5.3, F8.2 | `tests/unit/auth/IdleContext.test.tsx › "…arada saniyelik yeniden çizim yok"`; `Countdown` yalıtılmış bileşen | |
| `initPediatristFirebase()` her çizimde çalışıyor | ✅ | F0.3 | Modül düzeyinde tek örnek (`src/lib/firebase/client.ts`) | Otomatik test yok. |
| `recharts` / `lucide-react` kullanılmıyor; grafik erişilebilir değil | ✅ | F0.1, F5.4 | Bağımlılıklardan çıkarıldı; `e2e/quiz-results.spec.ts › "gelişim: …kendi grafiği…"` | Tek serili erişilebilir SVG. |
| İstemci emülatöre bağlanamıyor | ✅ | F0.3 | Bütün e2e paketi emülatörde koşar | |
| SSR bölgesi varsayılan `us-central1` | ✅ 🔎 | F2.5, D10 | `tests/unit/securityHeaders.test.ts › "SSR backend'i ortak REGION sabitiyle aynı bölgede…"` | Firestore konumu kurulumda seçilir (kontrol listesi A3). |
| Ders başında soğuk başlatma (`minInstances`) | ⬜ | — | — | **Yapılmadı.** Sürekli çalışan örnek aylık maliyet getirir; gerçek ders başı yükü görülmeden karar verilmedi. Staging'de ilk kalabalık derste gecikme ölçülüp kurum karar vermeli. |

## 8. Test, araçlar, işletim

| Bulgu | Durum | Adım | Kanıt | Not |
| --- | --- | --- | --- | --- |
| Testler üretim kodunu sınamıyor (`verify-platform.mjs`) | ✅ | F0.5 ve her modül | Birim 255, kural 58, functions 118, uçtan uca 58 senaryo × 2 ekran boyutu; hepsi üretim modüllerini içe aktarır | Eski sahte test dosyası silindi. |
| ESLint, Prettier, typecheck, CI, lockfile yok | ✅ | F0.1, F0.2 | `.github/workflows/ci.yml`; CI çalışması [#57](https://github.com/hansero/pediatrist/actions/runs/43108681873) | |
| Yedek, alarm, bütçe uyarısı yok | 🟡 | F9.2 | [`DEPLOY.md`](../../DEPLOY.md) bölüm 4–5; kritik olayların Cloud Logging'e düşmesi `functions/test/operations.test.ts` ile testli | Adımlar **belgelendi ama uygulanmadı** (gerçek proje yok). Kontrol listesi E1–E5. |
| README iki satır | ✅ | F9.3 | [`README.md`](../../README.md), [`DEPLOY.md`](../../DEPLOY.md) | |

## 9. Gizlilik ve uyum (KVKK)

| Bulgu | Durum | Adım | Kanıt | Not |
| --- | --- | --- | --- | --- |
| Aydınlatma metni ve onay yok; saklama politikası yok | 🟡 | F3.5, F9.1, F9.2 | `functions/test/members.test.ts › "KVKK onayı zorunlu ve yalnızca güncel sürüm kabul edilir (F3.5)"`; `functions/test/privacy.test.ts › "güncel sürüm onayı sürüm + zamanla kaydedilir…"`; `e2e/privacy.spec.ts › "onaysız üye içerik yerine onay ekranını görür…"`; `e2e/registration.spec.ts › "aydınlatma metni: sürümlü…"` | Altyapı tamam. **Metin hukuk birimince onaylanmadı** ("taslak" işaretli); eğitim kayıtlarının saklama süresi kurum kararı bekliyor (kontrol listesi F1–F3). |
| Hesap silme ve veri dışa aktarımı yok | ✅ | F9.1 | `functions/test/privacy.test.ts` (7 test; ör. `"hesap ve profil silinir; kayıtlar addan arındırılır ama istatistik kalır…"`, `"üye kendi verisini alır: …cevap anahtarı yok"`); `e2e/privacy.spec.ts › "admin veri dökümünü indirir ve üyeyi adını yazarak siler…"` | |
| Cihaz özetleri tuzsuz SHA-256 | ✅ | F4.2, F11.1 | S1 kanıtları | Cihaz özeti F4.2'de, passkey F11.1'de kaldırıldı (D23); kalan veri için `scripts/remove-attendance-device-data.ts`. |

---

## 10. Kullanıcı revizyonları (F11, 2026-11-13)

Denetim bulgusu değil; kullanıcının 7 maddelik isteği. Kararlar `REVISION_PLAN.md` §3 D23–D27.

| İstek | Durum | Adım | Kanıt | Not |
| --- | --- | --- | --- | --- |
| 1. Yoklama cihazı gereksiz (MFA yeterli) | ✅ | F11.1, D23 | `functions/test/attendance.test.ts › "eski istemcinin gönderdiği cihaz alanları … yok sayılır"`, `"MFA zorunluyken ikinci faktörsüz oturum yoklama veremez…"`; `tests/unit/securityHeaders.test.ts › "Permissions-Policy: kamera … passkey izinleri kapalı"` | KVKK metni 1.1 (yeniden onay). Staging verisi için temizlik betiği. |
| 2. QR'ı kamerayla okutma veya kodu girme | ✅ 🔎 | F11.2, D27 | `e2e/attendance.spec.ts › "QR kodu okut: kamera yalnızca düğmeyle açılır…"`, `"kamera izni verilmezse Türkçe açıklama çıkar…"`; `tests/unit/attendance/attendance.test.ts › "parseCheckInLink…"` | e2e'de kamera canvas akışıyla taklit edilir; gerçek telefon UAT B1. |
| 3. Ders başlatırken kategori yok | ✅ | F11.3 | `tests/unit/schemas.test.ts › "… ders kategorisi yoktur…"`; `functions/test/attendance.test.ts` (derste `category` yok); CSV başlıkları (`e2e/attendance.spec.ts`) | |
| 4. Materyalde serbest etiket | ✅ | F11.5, D25 | `tests/unit/materials/labels.test.ts`; `functions/test/materials.test.ts › "etiketler serbesttir…"`; `e2e/materials-admin.spec.ts › "yükle … → düzenle → sil…"` | Birden çok etiket; mevcut etiketler öneri olarak gelir. |
| 5. Admin süzgeci: arama \| etiket \| hedef kıdem | ✅ | F11.7 | `tests/unit/materials/admin.test.ts › "admin materyal süzgeci (F11.7)…"`; `e2e/materials-admin.spec.ts › "süzgeç: arama \| etiket \| hedef kıdem birlikte…"` | |
| 6. Hedef kıdemde "Uzman" | ✅ | F11.6, D26 | `tests/unit/materials/labels.test.ts › "materyal hedef kitlesi (D26, F11.6)"`; `functions/test/materials.test.ts › "hedef kitle 'Uzman'…"`; `e2e/materials-viewer.spec.ts › "uzman hesabı: varsayılan süzgeç 'Uzman (benim)'…"` | Yalnızca Uzm. Dr. (kullanıcı kararı). |
| 7. Yoklamayı admin yönetir, yalnızca 1–4. yıl asistan verir | ✅ | F11.4, D24 | `functions/test/attendance.test.ts › "D24: …"` (3 test); `functions/test/members.test.ts › "kıdem yılı yalnızca asistanlarda (D24)"`; `e2e/attendance.spec.ts › "uzman hesabında ders yoklaması yok…"` | Uzm./Doç./Prof. kayıt olabilir; yoklamaya tabi değildir. |

---

## Açık kalanlar

Aşağıdakiler bilinçli olarak yapılmadı ya da yalnızca siz yapabilirsiniz. Hiçbiri otomatik testlerin geçmesine
engel değil; canlıya çıkmadan önce her biri için karar verilmelidir.

### Yalnızca gerçek ortamda yapılabilenler (sizin tarafınızda)

1. **Staging kurulumu** ve `DEPLOY.md` adımlarının doğrulanması: [`STAGING_CHECKLIST.md`](STAGING_CHECKLIST.md).
   Komutlar ve konsol adımları resmî belgelerle karşılaştırılamadı.
2. **Kullanıcı kabul testi:** [`UAT_SCENARIOS.md`](UAT_SCENARIOS.md); özellikle ⚠ işaretli dokuz senaryo (gerçek
   e-posta, Authenticator, gerçek telefonda kamerayla QR okutma, ders salonu, Storage'dan PDF).
3. **KVKK aydınlatma metninin hukuk onayı**, yurt dışı aktarım dayanağı ve saklama süreleri.
4. **Yedek, alarm ve bütçe uyarılarının** kurulması ve bir geri yükleme tatbikatı.

### Bilinçli olarak yapılmayanlar (karar gerektirir)

| Konu | Bulgu | Neden yapılmadı | Risk |
| --- | --- | --- | --- |
| Hesaplayıcı formül motoru | Kullanılabilirlik, D8 | Klinik doğrulama ve referans değer testleri gerektirir; ayrı bir iş | Sayfa hesaplama yapmaz; yanlış doz riski yok, işlev de yok. |
| Yoklamada konum ya da salon içi ikinci etken | S2 | Konum izni ve bina içi doğruluk sorunlu; önce işaretleme denenmeli | Kod 15–30 sn içinde iletilirse salonda olmayan hekim kendi hesabıyla katılabilir; kayıt "farklı ağ" olarak işaretlenir. |
| Sunucuda sayfa görüntüsü üretme, imzalı kısa ömürlü adres | S13 | Kapsam ve maliyet; etiket düzeltildi | Erişimi olan üye özgün dosyayı tarayıcı araçlarıyla indirebilir; filigran yalnızca ekran görüntüsünü caydırır. |
| App Check tek kullanımlık belirteçleri | S10 | Emülatörde sınanamaz, her çağrıya gecikme ekler; hız sınırı var | Ele geçirilen bir App Check belirteci süresi dolana kadar yeniden kullanılabilir (oturum belirteci yine gerekir). |
| Denetim kayıtlarının BigQuery'ye aktarımı | S10 | Gereksinim belirsiz; kayıtlar Firestore'da ve yönetim panelinde | Uzun dönemli analiz ve saklama süresi sonrası arşiv yok. |
| Nonce tabanlı `script-src` | C6 | Next.js'in satır içi betikleri için ara katman gerektirir; her sayfayı dinamik yapar | `'unsafe-inline'` duruyor: bir XSS açığı bulunursa CSP satır içi betiği engellemez. |
| Otomatik bağımlılık denetimi | S14 | Depoda otomatik PR/uyarı açacağı için sormadan eklenmedi | Yeni güvenlik açıkları elle `npm audit` çalıştırılana kadar fark edilmez. |
| Sınav görselleri için içerik açıklaması | Erişilebilirlik | CSV biçimine yeni sütun gerektirir | Ekran okuyucu kullanan hekim görselli soruyu çözemez. |
| Sunucu tarafı sayfa koruması | Performans/mimari | Veri kurallarla korunuyor; oturum çerezi ayrı bir iş | Yönlendirme tarayıcıda yapılır; oturumsuz ziyaretçi veri göremez ama sayfa kabuğu sunucudan gelir. |
| `minInstances` (soğuk başlatma) | Performans | Sürekli maliyet; gerçek yük görülmeden karar verilmedi | Ders başında ilk yoklama istekleri birkaç saniye gecikebilir. |

### Otomatik testle kanıtlanamayanlar

Görsel hiyerarşi ve metin bulguları (jargon, düğme uzunluğu, renk anlamı), dokunma hedefi boyutu ve azaltılmış
hareket kuralı kaynak taramasıyla ve gözle denetlendi; bunlar için otomatik test yoktur. Anlaşılırlık ancak
kullanıcı kabul testinde ölçülebilir.
