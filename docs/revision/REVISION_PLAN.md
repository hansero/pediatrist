# Pediatrist — Aşamalı Revizyon Planı

> **Amaç:** `docs/revision/AUDIT.md` içindeki bütün bulguları kapatmak. Uygulama kodunda **tek bir mock veya uydurma (fabricated) veri kalmayacak**. Sonuçta, Firebase emülatörlerinde ve gerçek bir staging projesinde **gerçek kullanıcılarla teste hazır** bir full-stack uygulama elde edilecek.
>
> **Bu dosya, oturumlar arası tek gerçek kaynaktır.** Claude limiti dolduğunda veya oturum kapandığında yeni oturum bu dosyadan devam eder (bkz. §0 Devam Protokolü). Her adım bitince bu dosyadaki ilerleme tablosu güncellenir, değişiklik commit'lenir ve push'lanır.

- Branch: `feat/pediatrist-platform`
- Denetim raporu: [`AUDIT.md`](./AUDIT.md). Bulgu kimlikleri: `C1..C11` kritik, `S1..S15` güvenlik.
- Proje kuralları: kökteki [`CLAUDE.md`](../../CLAUDE.md)

---

## 0. Devam Protokolü (her oturumun başında)

1. `git fetch origin feat/pediatrist-platform && git checkout feat/pediatrist-platform && git pull origin feat/pediatrist-platform`
2. Bu dosyada **§1 İlerleme Tablosu**'nu ve **§2 Son Oturum Devir Notu**'nu oku.
3. `git log --oneline --grep "rev(F" | head -20` ile son tamamlanan adımı doğrula. Tablo ile git log çelişirse **git log esas alınır** ve tablo düzeltilir.
4. Bağımlılıkları kur: `npm ci && npm --prefix functions ci`. (F0.1 tamamlanmadıysa `npm install` kullan.)
5. Durumu 🟨 olan adım varsa önce onu bitir. Yoksa ilk ⬜ adıma başla.
6. **Adım bitiş ritüeli:**
   1. Adımdaki "Doğrulama" komutlarını çalıştır.
   2. Tabloyu ✅ yap.
   3. §2 Devir Notu'nu güncelle.
   4. `git commit -m "rev(Fx.y): <özet>"` ve ardından `git push -u origin feat/pediatrist-platform`.
7. **Oturum kesilmek üzereyse** (limit yaklaşıyor): yarım işi derlenebilir halde commit'le (`rev(Fx.y): WIP — <ne kaldı>`), adımı 🟨 işaretle, Devir Notu'na *tam olarak* sıradaki işi yaz ve push'la.

Durum simgeleri: ⬜ başlanmadı · 🟨 devam ediyor (WIP) · ✅ tamamlandı ve doğrulandı · ⛔ engelli (sebebi Devir Notu'nda)

Boyut: **S** küçük (tek oturumda rahat), **M** orta, **L** büyük (gerekirse WIP commit'leriyle bölünür)

---

## 1. İlerleme Tablosu

| Adım | Başlık | Boyut | Durum | Kapattığı bulgular |
|---|---|---|---|---|
| **F0** | **Zemin: araçlar, emülatör, test iskeleti** | | | |
| F0.1 | Bağımlılıklar, lockfile'lar, kullanılmayan paketler | S | ✅ | S14, §7 |
| F0.2 | Lint / typecheck / test script'leri + CI workflow | S | ✅ | §8 |
| F0.3 | İstemcinin emülatöre bağlanması + App Check debug + `.env` | S | ✅ | §7 |
| F0.4 | Emülatör seed script'i (test verisi YALNIZCA burada) | M | ✅ | (mock'ların yerine) |
| F0.5 | Eski sahte testleri kaldır, test iskeletleri + "no-mock" bekçisi | M | ✅ | §8 |
| **F1** | **Ortak domain ve API sözleşmeleri** | | | |
| F1.1 | `functions/src/shared`: sabitler, tipler, zod şemaları, `@shared` alias | M | ✅ | Tutarlılık tablosu |
| F1.2 | Ortak CSV doğrulayıcı + birim testleri | S | ✅ | Tutarlılık (CSV) |
| F1.3 | Functions: `guards.ts`, `validate.ts`, tüm callable'ların refactor'u | M | ✅ | C5 (kısmen), S8 |
| F1.4 | İstemci `callables.ts` yeniden yazımı, `AppError`, `useAsyncAction` | S | ✅ | C1 (temel) |
| **F2** | **Yetkilendirme temeli** | | | |
| F2.1 | `firestore.rules` yeniden yazımı + rules testleri | L | ✅ | C5, C7 (kural), S11, S12, C9 (davet) |
| F2.2 | `storage.rules` yeniden yazımı + testler | S | ✅ | C5, C11 (silme/MIME) |
| F2.3 | Claim senkronu, `tokensValidAfter`, üye yönetimi korumaları, sunucu tarafı kayıt, davetler | L | ✅ | C5, C9, S9 |
| F2.4 | `ClinicSessionContext` yeniden yazımı (canlı profil, token yenileme) | M | ✅ | C5 |
| F2.5 | Tek kaynaklı CSP, header'lar, SSR bölgesi | S | ✅ | C6, §7 bölge |
| **F3** | **UI temeli ve kimlik doğrulama UX** | | | |
| F3.1 | Tasarım token'ları, kontrast/odak, `next/font`, UI primitifleri | L | ✅ | Tutarlılık, Erişilebilirlik |
| F3.2 | Korumalı layout: `next/link`, aktif menü, mobil çekmece, hata/404/yükleniyor | M | ✅ | Kullanılabilirlik |
| F3.3 | `SessionGuard` yeniden yazımı (uyarı, muafiyet, odak tuzağı) | S | ✅ | C8 (temel) |
| F3.4 | Giriş: gerçek hata yönetimi, şifre sıfırlama, gerçek TOTP MFA | L | ✅ | C4 |
| F3.5 | Kayıt, KVKK onayı, e-posta doğrulama, bekleme/askı ekranları | M | ✅ | C9, Kullanılabilirlik |
| **F4** | **Yoklama modülü (gerçek)** | | | |
| F4.1 | Backend sağlamlaştırma (transaction, kilit, süre dolumu, zamanlayıcı) | M | ✅ | S3, S4, S5, S10 |
| F4.2 | WebAuthn passkey ile cihaz bağlama | L | ✅ | S1, C2 (biyometrik) |
| F4.3 | Admin: ders başlat/bitir + projektör kiosk sayfası (QR, wake lock) | M | ✅ | C2, C8 (projektör) |
| F4.4 | Hekim: QR deep-link ile yoklama + kişisel geçmiş | M | ✅ | C2 |
| F4.5 | Ders/katılımcı raporları + CSV | M | ✅ | C2, Kullanılabilirlik |
| F4.6 | Yoklama e2e testleri + mock bekçisi temizliği | M | ✅ | §8 |
| **F5** | **Sınav modülü (gerçek)** | | | |
| F5.1 | Backend: soruların attempt ile teslimi, `revealPolicy`, taslak kayıt, transaction | L | ✅ | C3, C7, S6, S7 |
| F5.2 | Admin sınav stüdyosu (taslak, yayın, kapatma, görsel yükleme, arşiv) | L | ✅ | C3 |
| F5.3 | Sınav ekranı (sunucu süresi, kalıcı yanıtlar, görseller, uyarılar) | M | ✅ | C3, C8 (sınav) |
| F5.4 | Hekim paneli + karne + admin analitiği | M | ✅ | C3, Kullanılabilirlik |
| F5.5 | Sınav testleri + mock bekçisi temizliği | M | ✅ | §8 |
| **F6** | **Materyaller modülü (gerçek)** | | | |
| F6.1 | Backend callable'ları + kurallar | M | ✅ | C11, S12 |
| F6.2 | Admin yükleme / düzenleme / silme / okunma raporu | M | ✅ | C11 |
| F6.3 | Görüntüleyici (pdf.js / video) + ilerleme takibi | L | ✅ | C11, S13 |
| F6.4 | Materyal testleri + mock bekçisi temizliği | S | ✅ | §8 |
| **F7** | **Admin paneli, dashboard, hesaplayıcılar** | | | |
| F7.1 | Üye paneli (onay/askı/rol, onay diyalogları) + davet yönetimi | M | ✅ | C10, Kullanılabilirlik |
| F7.2 | Denetim kaydı görüntüleyici (gerçek `audit_logs`) | S | ✅ | C10 |
| F7.3 | Durum odaklı dashboard + gerçek KPI'lar | M | ✅ | C10, Görsel hiyerarşi |
| F7.4 | Hesaplayıcılar: dürüst "yakında" durumu + `calculators_config` | S | ✅ | Kullanılabilirlik |
| F7.5 | `invokeWithFallback` ve tüm fallback'lerin silinmesi; bekçi listesi boş | S | ✅ | C1 (final) |
| **F8** | **Erişilebilirlik, metin, performans cilası** | | | |
| F8.1 | UX metni sadeleştirme + a11y düzeltmeleri + axe testleri | M | ✅ | Görsel hiyerarşi, Erişilebilirlik |
| F8.2 | Performans (timer izolasyonu), ölü kod, `admin.ts` kararı | S | ✅ | §7 |
| **F9** | **Uyum (KVKK) ve operasyon** | | | |
| F9.1 | Aydınlatma metni, rıza sürümü, üye silme ve veri dışa aktarımı | M | ✅ | §9 |
| F9.2 | Denetim kaydı TTL, hız sınırı, alarm, yedekleme runbook'u | S | ✅ | S10, §8 |
| F9.3 | README, `DEPLOY.md`, `Plan.MD` gerçeğe uygun güncelleme | S | ✅ | §8 |
| **F10** | **Gerçek teste hazırlık** | | | |
| F10.1 | Tam e2e paketi CI'da yeşil | M | ✅ | Hepsi |
| F10.2 | Staging Firebase projesi kurulum kontrol listesi | S | ✅ | Hepsi |
| F10.3 | Kullanıcı kabul testi (UAT) senaryoları | S | ✅ | Hepsi |
| F10.4 | Denetim izlenebilirlik kontrolü (her bulgu → kanıt) | S | ✅ | Hepsi |
| **F11** | **Kullanıcı revizyonları (2026-11-13)** | | | |
| F11.1 | Yoklama cihazını (passkey) kaldır | L | ✅ | Madde 1 (D23) |
| F11.2 | Uygulama içi QR okuyucu | M | ✅ | Madde 2 (D27) |
| F11.3 | Ders kategorisini kaldır | S | ✅ | Madde 3 |
| F11.4 | Yoklama verme yetkisi: yalnızca 1–4. yıl asistan | M | ⬜ | Madde 7 (D24) |
| F11.5 | Materyal etiketleri | M | ⬜ | Madde 4 (D25) |
| F11.6 | Hedef kitlede "Uzman" | M | ⬜ | Madde 6 (D26) |
| F11.7 | Admin materyal süzgeci | S | ⬜ | Madde 5 |
| F11.8 | Belgeler, izlenebilirlik, tam doğrulama | S | ⬜ | Hepsi |

---

## 2. Son Oturum Devir Notu

> Her oturum sonunda **üzerine yazılır**. Kısa ve tam olarak eyleme dönük olmalı.

- **Tarih:** 2026-11-13
- **Son tamamlanan adım:** F11.3 (ders kategorisi kaldırıldı). Öncesinde F11.1 (yoklama cihazı, D23), F11.2 (QR okuyucu). F0–F10 önceden tamamdı; kullanıcı 7 maddelik yeni revizyon istedi → **F11** fazı (§1, §5) ve kararlar D23–D27 (§3).
- **Devam eden adım:** —
- **Sıradaki iş:** F11.4 (yoklama verme yetkisi: yalnızca 1–4. yıl asistan, D24). Ardından sırayla F11.5 → F11.8; her adımın kapsamı §5 F11'de.
  - Kullanıcı kararları: birden çok etiket; "Uzman" yalnızca `Uzm. Dr.`; kamera izni "QR kodu okut" düğmesiyle, QR okununca hemen gönderim.
  - Staging zaten kuruluysa: `npx tsx scripts/remove-attendance-device-data.ts --project <id>` (kuru çalışma) → `--yes`.
  - Önceki dönemden kalanlar (staging, UAT, KVKK hukuk onayı, karar bekleyenler) için `docs/revision/TRACEABILITY.md` › "Açık kalanlar".
- **Ortamı çalıştırma:** `npm run emulators` → `npm run seed` → `npm run dev`; testler: `npm run test:rules | test:functions | test:e2e`.
- **Engeller / notlar:** Zaman aşımıyla kesilen e2e `next-server`'ı açık bırakabilir → önce `pkill -f next-server`. Bildirim bölgesi (`ToastProvider`) her sayfada `role="status"`/`role="alert"` taşır: e2e'de `getByRole("status")` metinle süzülmeli. Yeni e2e spec'leri `./fixtures/test`'ten import etmeli (CSP bekçisi); ek tarayıcı bağlamları `guardedContext()` ile. Yönetim paneli e2e yardımcıları `e2e/fixtures/admin.ts`'te: `createPendingMember`, `runMemberAction(admin, email, işlem, onay, sonuç)`.

---

## 3. Kalıcı Kararlar (D-kayıtları)

Bu kararlar bütün adımlar için geçerlidir. Değiştirmek için kullanıcı onayı gerekir. Değişiklik yapılırsa buraya tarih ve gerekçe ile eklenir.

| ID | Karar | Gerekçe | Kullanıcı değiştirebilir mi? |
|---|---|---|---|
| D1 | **Uygulama kodunda (`src/`, `functions/src/`) hiçbir mock, seed, `INITIAL_*`, `FALLBACK_*`, sahte isim veya istemci tarafında üretilmiş "başarılı" yanıt bulunmaz.** Test verisi yalnızca `scripts/seed-emulator.ts` içinde ve yalnızca emülatöre yazılır. | Kullanıcı talebi + AUDIT C1, C10 | Hayır |
| D2 | Ortak kod `functions/src/shared/` altında durur. Next tarafı `@shared/*` alias'ı ile import eder. | Functions deploy'u yalnızca `functions/` klasörünü yükler; ortak kod orada olmalı. | Evet |
| D3 | Yetkinin tek kaynağı `users/{uid}` dokümanıdır. Claim'ler önbellektir. Anında iptal `tokensValidAfter` (saniye) ile `request.auth.token.auth_time` karşılaştırılarak yapılır. | AUDIT C5 | Hayır |
| D4 | Kayıt, istemcide `createUserWithEmailAndPassword` ve ardından `completeRegistration` callable'ı ile yapılır. Profil dokümanını sunucu yazar. İşlem idempotenttir: profil eksikse girişte tekrar çağrılır. İstemcinin `users` koleksiyonuna doğrudan `create` izni kaldırılır. | AUDIT C9, S11. Blocking function Identity Platform gerektirir ve emülatörde daha zordur. | Evet |
| D5 | MFA, Identity Platform TOTP ile gerçek olarak uygulanır. Zorunluluk ~~`REQUIRE_MFA` parametresiyle~~ **`config/security` dokümanıyla (D20)** yönetilir: staging/prod'da `true`, emülatörde `false`. Bunun sebebi, Auth emülatörünün TOTP'yi desteklememesidir (F3.4'te doğrulandı: kayıt isteği `Missing phoneEnrollmentInfo` ile reddediliyor; emülatör yalnızca SMS faktörünü tanıyor). Sahte TOTP adımı tamamen silinir. | AUDIT C4 | Evet (MFA'sız devam seçilirse ekran ve iddialar tamamen kaldırılır) |
| D6 | ~~Yoklama cihaz bağlama WebAuthn platform passkey'leri ile yapılır (`@simplewebauthn/server` + `@simplewebauthn/browser`). `localStorage` sırrı kaldırılır. e2e testlerinde Playwright CDP sanal doğrulayıcısı kullanılır.~~ **D23 ile değişti (2026-11-13).** | AUDIT S1, C2 | Evet |
| D7 | Sınav sonucunun gösterimi her sınav için `revealPolicy` ile belirlenir: `after_close` (varsayılan; sınav kapanana kadar yalnızca puan ve doğru/yanlış görünür) veya `immediate` (anında tam karne). Doğru cevaplar istemci paketine hiçbir koşulda girmez. | AUDIT C7. Plan.MD'deki "anında karne" isteği korunur, varsayılan güvenli seçenektir. | Evet |
| D8 | Hesaplayıcı formül motoru bu revizyonun kapsamı dışındadır. Sayfa dürüst bir "Yakında" durumu gösterir. Admin protokol notları `calculators_config`'e gerçekten kaydedilir. Formül motoru ayrı bir faz olarak (F11, opsiyonel) eklenebilir. | Klinik risk; doğrulama ve referans değer testleri gerektirir. | Evet |
| D9 | CSP tek kaynaktan, `next.config.ts` üzerinden verilir. `firebase.json` içindeki `hosting.headers` kaldırılır. | AUDIT C6 | Hayır |
| D10 | Bölge: Functions ve SSR `europe-west1`. Firestore konumu staging kurulumunda `eur3` veya `europe-west1` seçilir. | KVKK, gecikme | Evet |
| D11 | Materyal koruması "filigranlı görüntüleme" olarak etiketlenir. "DRM" ifadesi kullanılmaz. `allowDownload` yalnızca indirme butonunu kontrol eder. | AUDIT S13. Dürüst etiketleme. | Evet |
| D12 | Callable hataları kullanıcıya her zaman gösterilir. Bir mutasyonun sonucu sunucudan onay gelmeden "başarılı" olarak gösterilmez (iyimser UI yok). | AUDIT C1 | Hayır |
| D13 | App Check zorunluluğu `ENFORCE_APP_CHECK` parametresiyle yönetilir: prod'da `true`, emülatörde `false`. İstemci emülatörde debug sağlayıcıyı kullanır. | Emülatörde test edilebilirlik | Hayır |
| D14 | Commit formatı `rev(Fx.y): <özet>`. Her adım en az bir commit'tir ve her commit'ten sonra push yapılır. | Oturumlar arası devamlılık | Hayır |
| D15 | **Kabul edilmiş risk:** `uuid <11.1.1` (GHSA-w5hq-g745-h8pq, orta). Firebase-admin/functions zincirinden geliyor. Açık yalnızca v3/v5/v6 fonksiyonları `buf` parametresiyle çağrıldığında oluşuyor; zincir bunları kullanmıyor. Çözümü major geçiş gerektiriyor (firebase-admin 14 + firebase-functions 7). Bu geçiş F10.2 öncesinde yeniden değerlendirilir. | Major yükseltme riski > istismar edilebilirlik | Evet |
| D16 | Major sürümler bu revizyonda sabit: Next 15, React 19, Firebase JS 11, firebase-admin 13, firebase-functions 6. Yükseltme (Next 16, Firebase 12+) revizyon sonrasında ayrı bir iştir. | Revizyonun kapsamını bağımlılık geçişiyle karıştırmamak | Evet |
| D17 | Functions testleri `firebase-functions-test` olmadan yazılır: kök vitest + v2 callable'ın `.run()` kancası + emülatör. | `firebase-functions-test` jest'i zorunlu bağımlılık olarak getiriyor | Evet |
| D19 | Sunumlar Storage'a **PDF olarak** yüklenir; pptx kabul edilmez. SVG de kabul edilmez. İzinli türler ve boyutlar `MATERIAL_UPLOAD` / `QUIZ_MEDIA_UPLOAD` sabitlerinde ve `storage.rules`'ta aynıdır (birim testiyle denetlenir). | Tarayıcı pptx'i görüntüleyemez, filigran uygulanamaz; SVG betik çalıştırabilir | Evet |
| D18 | Emülatör ve testler `demo-pediatrist` proje kimliğiyle çalışır. `demo-` önekli projeler gerçek bir Firebase projesine bağlanamaz, yani yanlışlıkla prod'a yazma riski yoktur ve emülatörler çevrimdışı çalışabilir. | Güvenli test izolasyonu | Hayır |
| D20 | **MFA zorunluluğunun tek kaynağı Firestore `config/security.requireMfa`** (N8; D5'in mekanizmasını değiştirir, kullanıcı onayıyla 2026-11-10). Firestore ve Storage kuralları (`isActive()` → `mfaSatisfied()`), Cloud Functions (`guards.ts`, profil ile aynı `getAll`) ve istemci (oturum bağlamı) aynı dokümanı `parseSecurityConfig` mantığıyla okur. **Doküman yoksa veya değer boolean `false` değilse MFA zorunludur.** Doküman istemciye salt okunur (oturum açmış herkes), yalnızca Admin SDK/konsoldan yazılır. Emülatör seed'i `requireMfa: false` yazar. Kendi profilini okuma MFA istemez. `REQUIRE_MFA` parametresi ve `NEXT_PUBLIC_REQUIRE_MFA` kaldırıldı. Maliyet: kurallı her istekte +1 doküman okuması. | AUDIT C4/C5, N8: şifresi çalınmış hesabın SDK ile doğrudan okuma yapması | Hayır |
| D21 | **E-posta doğrulama zorunluluğu da `config/security` dokümanında** (`requireEmailVerified`; kullanıcı onayıyla 2026-11-11). D20'deki MFA ile aynı mekanizma ve güvenli varsayılan (doküman yoksa veya değer boolean `false` değilse zorunlu). Firestore ve Storage kuralları (`securitySatisfied()` = MFA ve e-posta), `guards.ts` ve istemci (doğrulama ekranı) aynı dokümanı okur. Kendi profilini okuma e-posta doğrulaması istemez. `REQUIRE_EMAIL_VERIFIED` functions parametresi kaldırıldı. Emülatör seed'i `false` yazar. | Tek kaynak; kurallarda da zorunluluk | Hayır |
| D22 | **Ders kapanırken "katılmadı" kaydı yazılır** (kullanıcı kararı, 2026-11-11, seçenek A). Kapanışın her yolunda (admin bitirir, süre dolar, süresi dolmuş kilit yeni başlatmada temizlenir) dersin başındaki `expectedAttendees`'ten kaydı olmayanlara `records/{uid}` ve `attendance_logs/{ders}_{uid}`: `status: "absent"`, `method: "system_absent"`, `verifiedAt: null`, `markedAt`. Derse `absentCount` yazılır. Sonradan mazeret girilirse katılmadı → mazeretli (`absentCount` −1). Katılım oranı = katıldı / (katıldı + katılmadı); mazeretliler paydaya girmez. Ders başladıktan sonra üye olan hekim o ders için beklenmez. | Hekim kendi devamsızlığını görebilsin; raporlar tek kaynaktan | Evet |
| D23 | **Yoklamada cihaz bağlama yoktur** (D6'nın yerine; kullanıcı kararı 2026-11-13). Yetkinin kaynağı MFA'lı oturum (`guards.ts`), yoklama uygunluğu (D24) ve projektör kodudur. WebAuthn (sunucu, istemci, bağımlılıklar, `/account/device`, admin "cihaz sıfırla") tamamen kaldırıldı. Yeni kayıtların yöntemi `code`; `qr+webauthn` yalnızca eski kayıtlarda. Özellik açıkken kurulmuş projede kalan veri `scripts/remove-attendance-device-data.ts` ile silinir. | Hesap zaten MFA'lı; kodun iletilmesi riski (S2) passkey ile de vardı | Evet |
| D24 | **Yoklamayı yalnızca admin yönetir; yalnızca 1–4. yıl asistan verir** (kullanıcı kararı 2026-11-13). Başlatma, bitirme, projektör ve mazeret admin'e özel. Yoklama veren üye: `role == "user"`, ünvan `Asistan Dr.`, `residencyYear ∈ 1–4`. `expectedAttendees` ve D22 "katılmadı" kayıtları yalnızca bu üyeler içindir. Tek kaynak `isAttendanceEligible` (shared), sunucuda `guards.ts › requireAttendee`. | Uzman/öğretim üyeleri yoklamaya tabi değil | Evet |
| D25 | **Materyal sınıflaması serbest etikettir** (kullanıcı kararı 2026-11-13: birden çok etiket). 0–8 etiket, her biri ≤ 40 karakter; kırpılır, iç boşluklar teke iner, `tr` küçük harfe göre tekrarsız. `MATERIAL_CATEGORIES` kaldırılır; eski `category` alanı okunurken tek etiket sayılır. Öneriler mevcut materyallerden türetilir (ayrı koleksiyon yok). | Sabit liste klinik ihtiyaca uymuyor | Evet |
| D26 | **Materyal hedef kitlesi = `targetYears` (1–4) + `targetSpecialists`** (kullanıcı kararı 2026-11-13). En az biri dolu. "Uzman" yalnızca ünvanı `Uzm. Dr.` olan üyedir; Doç./Prof. hedef kitle dışında kalır, varsayılan süzgeçleri "Bütün kıdemler". Görünürlük kurallarda kısıtlanmaz (süzgeç ve rapor içindir). | Uzmanlara özel içerik | Evet |
| D27 | **QR okuma cihazda, `jsqr` ile** (kullanıcı kararı 2026-11-13: kamera izni "QR kodu okut" düğmesiyle istenir). Kamera görüntüsü kaydedilmez, gönderilmez; çözümleme ana iş parçacığında (CSP değişmez). `BarcodeDetector` kullanılmaz: tek kod yolu, e2e'de sınanan yolla aynı. | Uygulama içinden yoklama; KVKK | Evet |

---

## 4. Kabul Kapıları (her adım için geçerli)

Bir adım ✅ olmadan önce şunlar sağlanmalı:
1. `npm run lint && npm run typecheck` yeşil (F0.2'den sonra).
2. İlgili testler yeşil: birim (`npm run test:unit`), kural (`npm run test:rules`), function (`npm run test:functions`) ve e2e (`npm run test:e2e`, F4'ten itibaren ilgili spec).
3. `npm run check:no-mock` yeşil. Allowlist yalnızca küçülür, asla büyümez.
4. `npm run build` ve `npm --prefix functions run build` yeşil.
5. Yeni Türkçe UI metinleri kısa ve jargonsuz (RBAC, HMAC, DRM, Custom Claims, JSON gibi terimler kullanıcıya gösterilmez).

---

## 5. Fazlar ve Adımlar

### F0 — Zemin: araçlar, emülatör, test iskeleti

#### F0.1 Bağımlılıklar ve lockfile'lar (S)
- **Dosyalar:** `package.json`, `functions/package.json`, yeni `package-lock.json`, `functions/package-lock.json`
- **Yapılacaklar:**
  - Kök devDependencies: `firebase-tools`, `vitest`, `@firebase/rules-unit-testing`, `zod`, `tsx`, `eslint`, `eslint-config-next`, `eslint-plugin-jsx-a11y`, `@playwright/test`, `@axe-core/playwright`, `prettier`.
  - Kök dependencies: `qrcode`, `pdfjs-dist`, `@simplewebauthn/browser`. `recharts` ve `lucide-react` kullanılmıyor: kaldır (F5.4'te grafik gerekirse geri eklenir).
  - Functions dependencies: `zod`, `@simplewebauthn/server`. (Functions test araçları için bkz. D17.)
  - `next` ve `react`'i en güncel yamalı 15.x / 19.x sürümüne sabitle, ardından `npm audit` çalıştır.
  - `engines.node: "22"` ekle (kök).
  - Playwright notu: ortamdaki önceden kurulu Chromium kullanılacak. `@playwright/test` sürümü ortamdakiyle uyuşmazsa config'te `executablePath: '/opt/pw-browsers/chromium'` kullan. `playwright install` **çalıştırma**.
- **Doğrulama:** `npm ci && npm --prefix functions ci && npm audit --omit=dev`
- **✅ Uygulanan (2026-11-09) — plandan sapmalar:**
  - `zod`, istemci çalışma zamanında da kullanılacağı için kökte **dependency** oldu (devDependency değil).
  - `firebase-functions-test` **eklenmedi**: jest'i zorunlu bağımlılık olarak getiriyor. Functions testleri kök `vitest` ile, v2 `onCall` fonksiyonlarının `.run(request)` test kancası ve emülatöre bağlı Admin SDK kullanılarak yazılır (D17). Functions paketine `vitest` eklenmedi.
  - `@firebase/rules-unit-testing` **4.0.1**'de sabit: 5.x/6.x, Firebase JS 12/13 ve Node 24 istiyor (D16).
  - `@playwright/test` **1.63.0**'a sabitlendi (ortamdaki Chromium 1243 ile eşleşiyor; başlatma doğrulandı).
  - `eslint` 9.x: `eslint-config-next@15` en fazla 9'u destekliyor (9 upstream'de "desteklenmiyor" uyarısı veriyor; Next 16 geçişinde ele alınacak).
  - `overrides`: `@grpc/grpc-js ^1.14.7`, `postcss ^8.5.32` → **yüksek seviyeli bütün audit bulguları kapandı**. Kalan 8 orta seviye bulgunun tamamı `uuid <11.1.1` zinciri (firebase-admin → google-gax/gaxios/teeny-request) → kabul edilmiş risk (D15).
  - Çözülen sürümler: next 15.5.29, react/react-dom 19.3.1, firebase 11.10.0, firebase-admin 13.10.0, firebase-functions 6.6.0, typescript 5.9.3, vitest 5.1.0, firebase-tools 15.35.0, zod 4.6.7.
  - `.gitignore`'a eklendi: `functions/lib/`, `next-env.d.ts`, `*.tsbuildinfo`, test çıktıları.
  - Doğrulandı: `npm ci` (iki paket), `tsc --noEmit`, `functions build`, `next build` yeşil.

#### F0.2 Script'ler ve CI (S)
- **Dosyalar:** `package.json` scripts, `.eslintrc.json` (veya `eslint.config.mjs`), `.prettierrc`, `.github/workflows/ci.yml`, `functions/package.json` scripts
- **Script'ler:**
  - `lint`, `typecheck` (`tsc --noEmit` + `npm --prefix functions run typecheck`), `test:unit` (vitest), `test:rules`, `test:functions`, `test:e2e`, `emulators`, `seed`, `check:no-mock`.
  - `test:rules`, `test:functions` ve `test:e2e`, `firebase emulators:exec --only auth,firestore,storage,functions "<komut>"` ile sarmalanır.
- **CI:** Node 22 → `npm ci` (iki paket) → lint → typecheck → unit → `emulators:exec` içinde rules, functions ve e2e → build.
- **Doğrulama:** `npm run lint && npm run typecheck` (mevcut kodda çıkan lint hataları ya düzeltilir ya da ilgili faza not edilir; kural kapatılmaz).
- **✅ Uygulanan (2026-11-09) — plandan sapmalar:**
  - `next lint` Next 15.5'te kullanımdan kaldırıldığı için `lint` = `eslint .` (flat config `eslint.config.mjs`: `next/core-web-vitals` + `next/typescript` + `jsx-a11y` recommended). a11y kurallarının devrede olduğu deneme dosyasıyla doğrulandı. Etiketsiz `<select>` statik analizle yakalanmıyor; F8.1'de axe ile denetlenecek.
  - **Lint kapısı şimdilik "0 hata".** Mevcut 2 uyarı yeniden yazılacak dosyalarda: `SessionGuard.tsx` `remainingSeconds` (F3.3'te kullanılacak) ve `AdminMaterialManager.tsx` `setFileType` (F6.2'de dosya türü seçimi). **F8.1'de `--max-warnings=0`'a geçilir.**
  - Prettier (`.prettierrc.json`: 120 kolon, çift tırnak) kod tabanının tamamına **ayrı bir commit'te** uygulandı (`rev(F0.2): format…`, yalnızca biçimlendirme). `*.md` hariç.
  - Bu adımda eklenen script'ler: `lint`, `format`, `format:check`, `typecheck` (Next + functions), `test` → `test:unit`, `test:unit` (vitest `unit` projesi), `emulators` (`--project demo-pediatrist`, D18). `seed` F0.4'te, `test:rules` / `test:functions` / `test:e2e` / `check:no-mock` ve CI emülatör işleri F0.5'te eklenir (hedef dosyaları o adımlarda oluşuyor).
  - `vitest.config.mts` (projects: `unit`) + gerçek modülü import eden ilk birim testi `tests/unit/quizParser.test.ts` (8 test).
  - CI: `.github/workflows/ci.yml` → npm ci (iki paket) → lint → format:check → typecheck → unit → functions build → next build.
  - **Bulgu:** Eski `npm test` (`node --test tests/`) Node 22'de hiç çalışmıyordu (klasör argümanı desteklenmiyor). Yani repodaki test paketi daha önce hiç koşmamış. Dosya doğrudan çalıştırılınca 6/6 geçiyor; F0.5'te silinecek.

#### F0.3 İstemcinin emülatöre bağlanması (S)
- **Dosyalar:** `src/lib/firebase/client.ts`, `.env.example`, `firebase.json` (emulators bölümü)
- **Yapılacaklar:**
  - `NEXT_PUBLIC_USE_EMULATORS=true` olduğunda `connectAuthEmulator`, `connectFirestoreEmulator`, `connectStorageEmulator` ve `connectFunctionsEmulator` çağrılır (tek seferlik, modül seviyesinde memoize).
  - Emülatörde `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` ayarlanır.
  - `initPediatristFirebase()` modül seviyesinde memoize edilir (AUDIT §7).
  - `.env.example`'a `NEXT_PUBLIC_USE_EMULATORS`, `NEXT_PUBLIC_REQUIRE_MFA` ve `NEXT_PUBLIC_WEBAUTHN_RP_ID` eklenir. `MEASUREMENT_ID` kaldırılır (S15).
  - Functions parametreleri (`defineBoolean`): `ENFORCE_APP_CHECK`, `REQUIRE_MFA`, `REQUIRE_EMAIL_VERIFIED`. Emülatör değerleri `functions/.env.local` içinde verilir (gitignore'da).
- **Doğrulama:** `npm run emulators` ayağa kalkar; `npm run dev` ile emülatöre bağlanılır (Auth emülatör UI'da kullanıcı oluşur). **Risk:** jar indirme engellenirse ⛔ işaretle ve ağ izni iste.
- **✅ Uygulanan (2026-11-09) — plandan sapmalar:**
  - **Emülatör env dosyaları git'te:** `.env.development` (`next dev` otomatik yükler; `demo-pediatrist`, gizli değer yok) ve `functions/.env.demo-pediatrist` (CLI yalnızca bu proje kimliğinde yükler). Plandaki `functions/.env.local` yerine bunlar seçildi; böylece CI ve yeni oturumlar ek ayar olmadan çalışır. `.gitignore`'a istisna eklendi. Gerçek proje için `.env.example` → `.env.local`.
  - `client.ts`: modül seviyesinde tekil başlatma; `NEXT_PUBLIC_USE_EMULATORS=true` iken `demo-` öneki yoksa hata fırlatır; portlar tek kaynaktan, `firebase.json`'dan okunur; App Check emülatörde başlatılmaz; `NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN` yalnızca localhost→staging için. `MEASUREMENT_ID` kaldırıldı (S15).
  - `functions/src/config.ts`: `ENFORCE_APP_CHECK`, `REQUIRE_MFA`, `REQUIRE_EMAIL_VERIFIED` (`defineBoolean`, varsayılan `true`). **`onCall({enforceAppCheck})` yalnızca sabit boolean kabul ettiği için** App Check zorunluluğu **F1.3'te `guards.ts` içinde** `ENFORCE_APP_CHECK.value()` ile uygulanacak. Callable'lardaki `enforceAppCheck: true` o zamana kadar yerinde kalıyor. Parametreler henüz hiçbir yerde import edilmiyor; F1.3'te bağlanacak.
  - `firebase.json`: bütün emülatörler `127.0.0.1`'e bağlandı (ortamda IPv6 yok). Eventarc/tasks dahil.
  - **`scripts/firebase.mjs` sarmalayıcısı:** (a) `hosting.source` için `webframeworks` deneysel özelliğini her çağrıda açar (Windows uyumlu); (b) proxy arkasındaki ortamlarda `firebase-tools` `NO_PROXY`'yi yok saydığı için (`lib/apiv2.js`) jar'ları proxy açıkken indirir, emülatörleri proxy değişkenleri temizlenmiş olarak çalıştırır. `emulators`, `deploy:rules`, `deploy:functions` script'leri bunu kullanır. `emulators` artık `--only auth,firestore,storage,functions` (hosting emülatörü Next'i derlemesin diye).
  - **CSP'nin geliştirme/emülatör kısmı F2.5'ten öne alındı:** `next dev` için `'unsafe-eval'`, emülatör modunda `127.0.0.1:*` / `localhost:*` (connect, img). **Üretim CSP'si değişmedi** (`next start` başlığıyla doğrulandı). F2.5 üretim düzeltmeleri aynen geçerli.
  - **Doğrulandı (gerçek tarayıcı, Playwright):** `/register` → Auth emülatöründe kullanıcı → Firestore `users/{uid}` (pending) → `onClinicMemberCreated` tetikleyicisi → custom claims `{role:user,status:pending}` → `audit_logs` kaydı (sunucu zaman damgasıyla). Konsolda hata yok. Ayrıca lint, format, typecheck, unit 8/8, prod build yeşil.
  - Yeni bulgular N1–N3 (bkz. §7).

#### F0.4 Emülatör seed script'i (M)
- **Dosyalar:** `scripts/seed-emulator.ts`, `scripts/fixtures/*.json`, `scripts/fixtures/quiz_media/*.png`, `scripts/fixtures/materials/*.pdf`
- **Kural:** Script `FIRESTORE_EMULATOR_HOST` ve `FIREBASE_AUTH_EMULATOR_HOST` tanımlı değilse **çalışmayı reddeder** (prod'a yanlışlıkla yazamaz).
- **İçerik (yalnızca test amaçlı):**
  - 1 aktif admin, 4 aktif asistan (kıdem 1–4), 1 bekleyen, 1 askıdaki kullanıcı. Şifreler `scripts/fixtures/README.md`'de belgelenir.
  - 1 davet kodu.
  - 2 materyal (gerçek küçük PDF ve görsel Storage emülatörüne yüklenir).
  - 1 taslak ve 1 kapanmış sınav (callable'lar üzerinden oluşturulur, böylece sunucu doğrulaması da test edilir).
  - 1 kapanmış yoklama oturumu ve kayıtları.
- Mevcut klinik örnek içerik (Kawasaki/krup soruları vb.) **buraya taşınır** ve uygulama kodundan silinir.
- **Script:** `"seed": "tsx scripts/seed-emulator.ts"` (emülatör ortam değişkenleri `demo-pediatrist` için ayarlanmış olmalı).
- **Doğrulama:** `npm run emulators` + ayrı terminalde `npm run seed` → Emülatör UI'da dokümanlar görünür.
- **✅ Uygulanan (2026-11-09) — plandan sapmalar:**
  - **Sınavlar bu adımda seed edilmedi.** Mevcut callable'lar `enforceAppCheck: true` ve Functions emülatörü App Check token'ı olmayan çağrıyı reddediyor (`firebase-functions/lib/common/providers/https.js`: `tokenStatus.app === "MISSING" && enforceAppCheck` → `unauthenticated`). Sınav şeması da F5.1'de değişeceği için **sınav seed'i F5.1'e taşındı** (callable'lar üzerinden; ayrıntı F5.1'de).
  - Mevcut sınav sayfasındaki 3 klinik örnek soru `scripts/fixtures/quiz-ornek.csv`'ye taşındı. Üreteç `build-quiz-csv.ts`, gerçek ayrıştırıcıdan 0 hata şartı arıyor. **Uygulama kodundan silinmeleri F5'te.**
  - Script emülatör adreslerini `firebase.json`'dan **kendisi ayarlıyor** (ortam değişkeni gerekmez). Çalışmayı reddettiği durumlar: emülatöre ulaşılamıyor, ortamda yerel olmayan bir emülatör adresi var, `GCLOUD_PROJECT`/`GOOGLE_CLOUD_PROJECT` `demo-` önekli değil. Üçü de denendi. `GOOGLE_APPLICATION_CREDENTIALS` yok sayılıyor; `METADATA_SERVER_DETECTION=none`.
  - Varsayılan davranış sıfırla + yükle (deterministik); `--no-reset` ile yalnızca ekler. Sabit uid'ler (`seed-admin`, `seed-asistan-1..4`, `seed-bekleyen`, `seed-askida`).
  - İçerik: 7 kullanıcı (Auth + claims + `users`, e-postalar doğrulanmış), 1 davet, 2 gerçek PDF + `materials` dokümanı, `quiz_media/steeple_sign.png`, 1 kapanmış yoklama (2 katıldı, 1 mazeretli, 1 katılmadı). Hesaplar ve şifre `scripts/fixtures/README.md`'de.
  - **Doğrulandı (istemci SDK + gerçek kurallar):** aktif asistan PDF indirir, materyal listeler, yalnızca kendi yoklama logunu okur; başkasının logu `permission-denied`; bekleyen kullanıcı Storage'da `storage/unauthorized`, Firestore'da `permission-denied`; admin 7 kullanıcıyı listeler. Seed admin gerçek arayüzde giriş yaptı (Playwright).
  - Canlı doğrulanan denetim bulguları: **C9** (asistan `invitations`'ı okuyabiliyor) ve **C4** (2FA adımı `123456` ile geçiyor).

#### F0.5 Test iskeleti ve "no-mock" bekçisi (M)
- **Dosyalar:**
  - Silinecek: `tests/verify-platform.mjs` (kaynak kodu string-grep'leyen, mantığı kopyalayan ve başka bir makineye ait mutlak yol içeren test).
  - Yeni: `vitest.config.ts`, `tests/unit/`, `tests/rules/` (`@firebase/rules-unit-testing`), `functions/test/` (kök vitest ile çalışır, gerçek modülleri import eder; callable'lar `.run({data, auth, rawRequest})` ile çağrılır, Firestore/Auth emülatörüne bağlıdır — D17), `e2e/` (`playwright.config.ts`, `fixtures/auth.ts` ile emülatörde kullanıcı girişi), `scripts/check-no-mock.mjs`.
- **No-mock bekçisi:** `src/` ve `functions/src/` içinde şu desenleri arar: `INITIAL_`, `FALLBACK_`, `invokeWithFallback`, `Selim Kaya`, `Elif Demir`, `Burak Şahin`, `Mert Yılmaz`, `Ayşe Aksoy`, `uid_user_`, `uid_admin_`, `att_session_`, `quiz_active_current`, `Math.random(` (attendance), `hmacSlotCode`, `sampleGraded`, `76 / 100`.
  - Mevcut ihlaller `scripts/no-mock-allowlist.json` dosyasına **dosya bazında** yazılır.
  - Her modül fazı kendi dosyalarını listeden çıkarır. F7.5'te liste **boş** olur ve dosya silinir.
- **Script'ler:** `test:rules`, `test:functions` (`firebase emulators:exec --only auth,firestore,storage --project demo-pediatrist "vitest run --project <ad>"`), `test:e2e` (`… --only auth,firestore,storage,functions … "playwright test"`), `check:no-mock`. vitest.config.mts'e `rules` ve `functions` projeleri eklenir.
- **CI:** `.github/workflows/ci.yml`'e `actions/setup-java` + emülatör işleri (rules, functions, e2e) eklenir.
- **Doğrulama:** `npm run test:unit` (en az parser testleri), `npm run check:no-mock` (yalnızca allowlist dışında ihlal varsa kırmızı).
- **✅ Uygulanan (2026-11-09) — plandan sapmalar ve sonuçlar:**
  - `tests/verify-platform.mjs` silindi.
  - **Kural testleri** (`tests/rules/`, `npm run test:rules`): 15 geçen + **4 `it.fails`**. `it.fails`, bilinen açığı belgeler: açık var oldukça "geçer", kapatılınca kırmızıya döner ve `it`'e çevrilmesi gerekir. Açıklar: **C5** (askıya alınmış üye eski token'la okur) → F2.1; **C7** (sorular sınav başlamadan okunur) → F2.1/F5.1; **C9** (davetler herkese açık) → F2.1; **C11** (admin Storage'da dosya silemez; kök neden: silmede `request.resource` null → `storage.rules:17` "Null value error") → F2.2.
  - **Functions testleri** `functions/test/` altında (**`tests/functions` değil**): testler kökteki `firebase-admin` kopyasını kullanırsa functions kodu ayrı bir SDK örneği görür. `functions/` altında Node çözümlemesi functions'ın kendi paketlerini bulur. Typecheck için `functions/test/tsconfig.json`; functions `typecheck` script'i testleri de kapsıyor. 5 test: `updateMemberAccess.run()` (oturumsuz → `unauthenticated`, asistan → `permission-denied`, admin → claim + profil + denetim kaydı) ve `onClinicMemberCreated.run()` (claim senkronu, geçersiz rolün `user`'a indirgenmesi).
  - **N2 koruması statik:** functions testleri kodu Node'da çalıştırdığı için emülatöre özgü N2'yi yakalayamaz. Bu yüzden ESLint `no-restricted-imports`, `functions/src` içinde `firebase-admin` namespace import'unu yasaklıyor (deneme dosyasıyla doğrulandı).
  - **E2E** (`e2e/`, `npm run test:e2e`): **üretim derlemesine** (`next build` + `next start`, port 3100) karşı. Emülatör ayarları `.env.development`'tan `util.parseEnv` ile veriliyor; böylece üretim CSP'si de test ediliyor. Projeler: `masaustu` (1280) ve `telefon` (390, Chromium). Script: functions build → `emulators:exec` → seed → playwright. Duman testi 6/6: admin, asistan ve bekleyen kullanıcı rol bazlı giriş. Giriş yardımcısı `e2e/fixtures/auth.ts` şimdilik sahte TOTP adımını sürüyor; F3.4'te güncellenecek.
  - **Sahte veri bekçisi** (`scripts/check-no-mock.mjs`): sabit desenler + uydurma kişiler + **seed kimlikleri** (isim/e-posta, `seed-data.ts`'ten okunur) + `scripts/fixtures` import'u + `Math.random(`. İzin listesi `scripts/no-mock-allowlist.json`'da dosya bazında ve faz etiketli (9 dosya: F4.3 ×2, F4.4, F5.2, F6.2 ×2, F7.1, F7.3, F7.5). Liste yalnızca küçülür: temizlenen dosya listede kalırsa hata. Üç durum da denendi.
  - **CI:** `verify` işine `check:no-mock` eklendi. Yeni `emulator-tests` işi: Java 21 (temurin), emülatör jar önbelleği, functions build, rules, functions, Playwright Chromium kurulumu, e2e; hata olursa rapor artifact'ı.

---

### F1 — Ortak domain ve API sözleşmeleri

#### F1.1 Ortak paket (M)
- **Dosyalar:** `functions/src/shared/{constants,types,schemas,index}.ts`, kök `tsconfig.json` (`paths: {"@shared/*": ["./functions/src/shared/*"]}`), `next.config.ts` (gerekirse `transpilePackages` / `experimental.externalDir`)
- **İçerik:**
  - **Sabitler:** `REGION`, `SLOT_MS`, `CODE_ALPHABET`, `QUESTION_TYPES`, `MATERIAL_CATEGORIES` (tek liste), `LECTURE_CATEGORIES`, `TITLES`, `RESIDENCY_YEARS`, `LIMITS` (ders 1–240 dk, sınav 1–180 dk, soru ≤200, metin yanıtı 1–2000).
  - **Domain tipleri:** `Member`, `AttendanceSession`, `AttendanceRecord`, `Quiz`, `QuizQuestionPublic`, `QuizAttempt`, `GradedItem`, `Material`, `MaterialProgress`, `AuditLog`, `Invitation`.
  - **zod şemaları:** **her callable için** `Request` ve `Response`. Takma ad parametreler (`dynamicCode|dynamicToken`, `deviceId|clientDeviceSecret`, `resetBoundDevice|resetDeviceBinding`) kaldırılır.
- `src/components/security/SessionGuard.tsx` ve `AdminLiveAttendanceProjector.tsx` içindeki tipler buraya veya `src/domain/`'e taşınır.
- **Doğrulama:** `npm run typecheck` (iki paket de `@shared`'i çözer), `npm run build`.
- **✅ Uygulanan (2026-11-10) — plandan sapmalar:**
  - `functions/src/shared/`: `constants.ts` (REGION, roller/durumlar, ünvanlar, kıdem, yoklama kodu alfabesi/uzunluğu/slot, ders ve **tek materyal kategori listesi** (6), soru tipleri, teslim toleransı, denetim seviyeleri, `LIMITS`), `types.ts` (Firestore doküman tipleri + `COLLECTIONS`), `schemas.ts` (11 callable için zod istek/yanıt + `CALLABLES` kayıt defteri ve `CallableRequestInput/Data/Response` tip yardımcıları), `index.ts`.
  - **Doküman tipleri `T` zaman damgası parametresi alır** (`MemberDoc<Timestamp>`); ortak klasör hiçbir Firebase SDK'sına bağımlı değil.
  - **Sözleşme değişiklikleri (sunucuya F1.3'te bağlanacak):** takma adlar kaldırıldı (yoklama: `code` + `deviceId`; üye: `resetBoundDevice`). Kendi beyanına dayalı `webAuthnVerified` sözleşmede **yok**: zod bilinmeyen alanı atar, sunucu artık sahte `qr+webauthn` etiketi yazamaz. Yoklama süre sınırı tek değer: 240 dk (arayüzdeki 180 F4.3'te düzelir). Soru görseli yalnızca `quiz_media/…` Storage yolu.
  - **F1.3 ile F1.4 arka arkaya yapılmalı:** F1.3 sunucuyu yeni parametre adlarına geçirince eski istemci adlarıyla gönderilen çağrılar `invalid-argument` alır. Yoklama istemcisi zaten mock (F4'te yeniden yazılıyor), admin sayfası `resetBoundDevice` gönderdiği için etkilenmiyor.
  - Hata mesajları alan etiketli Türkçe (`requiredText`, `intInRange`, `docId` yardımcıları). zod 4'ün `z.locales.tr()` yerel ayarı mevcut ve F1.3'te `validate.ts`'te yedek olarak açılacak.
  - Alias: kök `tsconfig.json` (`@shared`, `@shared/*`), `vitest.config.mts`. Functions tarafı **göreli import** kullanıyor (`./shared/constants`).
  - **Tek zod kopyası:** `next.config.ts` webpack alias'ı `zod`'u kök `node_modules`'a bağlıyor (yoksa `@shared` dosyaları `functions/node_modules/zod`'u paketlerdi). İstemci henüz zod import etmediği için paket analizi **F1.4'te** yapılacak (`.next/static` içinde tek zod).
  - Tekrarlanan sabitler ortak modüle bağlandı: functions (REGION ×3 dosya, slot/alfabe/uzunluk, soru tipleri, teslim toleransı), `client.ts` (REGION), `quiz-parser` (soru tipleri).
  - `ClinicMemberSession` UI tipi `SessionGuard.tsx`'ten `src/lib/auth/types.ts`'e taşındı (rol/durum ortak modülden); 7 import güncellendi. **Yoklama UI tipleri (`AttendanceSessionItem` vb.) taşınmadı**: mock'a özgü alanlar içeriyorlar (`hmacSlotCode`) ve F4.3'te silinecekler.
  - `tests/unit/schemas.test.ts` (16 test): kurallar, Türkçe mesajlar, takma adların ve `webAuthnVerified`'ın reddi, **repodaki örnek CSV'nin sunucu sözleşmesinden geçmesi**, ve **`functions/src/index.ts`'teki her callable'ın `CALLABLES`'ta sözleşmesi olması** (sözleşmesiz bir export eklenerek testin kırmızıya döndüğü doğrulandı).
  - Doğrulandı: lint, format, typecheck (iki paket), no-mock, unit 24, functions + next build, rules 15 + 4 `it.fails`, functions 5, e2e 6.

#### F1.2 Ortak CSV doğrulayıcı (S)
- **Dosyalar:** `functions/src/shared/quizCsv.ts` (`src/lib/quiz-parser` buradan re-export eder veya silinir), `tests/unit/quizCsv.test.ts`
- **Yapılacaklar:**
  - İstemci ve sunucu aynı `validateQuestion()` fonksiyonunu kullanır.
  - Başlık **isimleri** `NINE_FIELD_CSV_HEADERS` ile doğrulanır.
  - `imageUrl` yalnızca `quiz_media/` Storage yolu kabul eder (harici URL'ler CSP'ye takılır).
  - Tekrarlı seçenekler ve metin uzunluğu kuralları iki tarafta aynıdır.
  - İstemcideki `evaluateClinicalQuizAttempt` silinir: puanlama yalnızca sunucuda yapılır.
  - CSV dışa aktarımı tek fonksiyondan yapılır (`downloadCsv`): `;` ayırıcı, BOM ve formül enjeksiyonu koruması.
- **Testler:** RFC-4180 tırnak/satır sonu, `;`/`,` algılama, Türkçe normalizasyon, her hata türü, başlık sırası hatası.
- **✅ Uygulanan (2026-11-10) — plandan sapmalar:**
  - **Tek doğrulama kaynağı zod şemasıdır:** `functions/src/shared/quizQuestion.ts` → `QuizQuestionInput` (yapısal kurallar + `superRefine` ile alanlar arası kurallar + `transform` ile normalizasyon). Plandaki ayrı `validateQuestion()` fonksiyonu yerine CSV ayrıştırıcı (`quizCsv.ts`) her satırı **aynı şemadan** geçiriyor. Böylece önizleme ile sunucu arasında ikinci bir kural kodu yok. Döngüsel import olmasın diye şema `schemas.ts`'den ayrı dosyada; `schemas.ts` ve `quizCsv.ts` onu import ediyor.
  - Alanlar arası kurallar: Text Input ⇔ maxLength 1–2000 tam sayı ve yanıtlar maxLength'i aşamaz; seçenekli soruda ≥2 seçenek, tekrarlı seçenek yok, doğru cevaplar seçeneklerde, tekrarlı doğru cevap yok; Single Choice tam 1 doğru. Görsel yalnızca `quiz_media/…` (istemci eskiden `https://` kabul ediyordu, sunucu her şeyi kabul ediyordu).
  - Normalizasyon: seçenekler tek listede (`optionsArray` yoksa `optionsRaw` bölünür), `optionsRaw` listeden üretilir, açık uçluda seçenekler boşalır, seçenekli soruda `maxLength` 0.
  - **Başlık adları** sırasıyla doğrulanıyor (büyük/küçük harf ve boşluk duyarsız). Eskiden yalnızca sütun sayısına bakılıyordu ve yer değiştirmiş sütunlar sessizce yanlış alana eşleniyordu.
  - `src/lib/quiz-parser` ince istemci katmanına indi: ortak ayrıştırıcıyı re-export ediyor, UI tiplerini (`GradedQuestionFeedback` = ortak `GradedItem`) ve şablon üretecini tutuyor. **`evaluateClinicalQuizAttempt` silindi.** Mock sınav sayfasında (F5.2'de yeniden yazılacak) iki kullanımı kaldırıldı: admin karne incelemesi artık uydurma karne üretmiyor; sınav teslimi istemcide puanlamaya düşmüyor, sunucu hatası kullanıcıya gösteriliyor.
  - **Tek CSV yazıcısı:** `src/lib/csv.ts` (`toCsv` saf fonksiyon, `escapeCsvCell`, `downloadCsv`, `downloadTextFile`): `;` ayırıcı (Türkçe Excel), BOM, CRLF, formül enjeksiyonu koruması, indirme bağlantısı gecikmeli iptal ediliyor. Eski `hooks.ts → downloadCsv`, `downloadQuizLogsAsCsv` (koruması yoktu, URL'i iptal etmiyordu) ve `AdminQuizStudio`'daki kendi Blob kodu bu yazıcıya geçti. Not: koruma eklenen hücreler (`-5` → `'-5`) yeniden içe aktarılırsa `'` metnin parçası olur (OWASP önerisi, kabul edildi).
  - İndirilebilir sınav şablonu artık `;` ile yazılıyor ve ayrıştırıcıdan hatasız geçtiği testle garanti ediliyor.
  - **Sunucu henüz bu şemayı kullanmıyor:** `quizService.ts → sanitizeQuestion` F1.3'te `SaveQuizDraftRequest` ile değiştirilecek.
  - Testler (unit toplam 49): **15 varyantlı istemci/sunucu eşdeğerlik testi** (CSV önizleme kararı = `SaveQuizDraftRequest` kararı; ayrıca 11 geçersiz varyantın gerçekten reddedildiği doğrulanıyor), normalizasyon, satır/sütun etiketi, başlık adı (yer değiştirme + harf duyarsızlığı), CSV yazıcısı (formül koruması, tırnaklama, yazıcı→ayrıştırıcı gidiş-dönüş), şablon.

#### F1.3 Functions koruyucuları (M)
- **Dosyalar:** `functions/src/guards.ts`, `functions/src/validate.ts`, `functions/src/auditLogger.ts`, tüm servisler
- **guards.ts:**
  - `requireAuth(req)`.
  - `requireActive(req)`: `users/{uid}` dokümanını okur. `status==='active'`, `auth_time > tokensValidAfter`, `REQUIRE_EMAIL_VERIFIED` ise `email_verified`, `REQUIRE_MFA` ise `firebase.sign_in_second_factor` kontrol edilir. Dönüş değeri `{uid, email, profile}`.
  - `requireAdmin(req)`: `requireActive` + `role==='admin'`.
- **validate.ts:** `parse(schema, data)`. zod hatası `HttpsError('invalid-argument', <Türkçe alan mesajı>)` olarak döner.
- **auditLogger.ts:** `auditInBatch(batch|tx, input)` eklenir: denetim kaydı ana yazımla **aynı** batch/transaction içinde yazılır. `ipHash` = `sha256(salt + rawRequest.ip)`; salt, `defineSecret('AUDIT_IP_SALT')` olarak tanımlanır.
- Bütün `onCall`'lar `{ enforceAppCheck: ENFORCE_APP_CHECK, region: REGION }` ayarlarını kullanır.
- Üç kopya `assertAdmin` / `assertActiveMember` silinir.
- **Doğrulama:** `npm --prefix functions run build`, `npm run test:functions` (koruyucu testleri: askıdaki kullanıcı, iptal edilmiş token, admin olmayan kullanıcı).
- **✅ Uygulanan (2026-11-10) — plandan sapmalar:**
  - **`functions/src/callable.ts` → `defineCallable(name, "admin" | "member", handler)`:** her callable aynı sırayla korunur: (1) yetki (`guards.ts`), (2) `CALLABLES[name].request` ile doğrulama, (3) handler; handler'ın dönüş tipi `CALLABLES[name].response` ile uyumlu olmak zorunda. Yetki doğrulamadan **önce** gelir, böylece oturumsuz kullanıcıya şema ayrıntısı sızmaz. 11 callable'ın hepsi bununla tanımlı; üç kopya `assertAdmin`/`assertActiveMember` ve bütün `enforceAppCheck: true` kullanımları silindi.
  - **`guards.ts`:**
    - Yetki `users/{uid}` dokümanından okunur. **C5 fonksiyon katmanında kapandı:** askıya alınmış üye eski "active" token'la geçemez, dokümanda `user` olan kullanıcı claim'de admin yazsa da admin işlemi yapamaz. Kural katmanında C5 F2.1'de kapanacak.
    - `tokensValidAfter` (epoch saniye) ile `auth_time` karşılaştırması uygulanıyor; alanı F2.3 yazacak (`MemberDoc`'a eklendi).
    - App Check, MFA ve e-posta doğrulaması parametreyle yönetiliyor.
    - **Güvenli varsayılan:** zorunluluk yalnızca ortam değişkeni açıkça `"false"` ise kapanır. Gerekçe için N5.
  - **`validate.ts`:** zod hatası → `invalid-argument` + Türkçe mesaj (en fazla 3 sorun; sınav sorularında `Satır N:` öneki). `z.locales.tr()` yedek olarak açık. Ayrıntılar `details.issues` içinde.
  - **`auditLogger.ts` → `auditIn(batch | transaction, …)`:** başarılı işlemlerin denetim kaydı ana yazımla **aynı batch/transaction**'da yazılıyor (S10'un bu kısmı kapandı). Reddedilen girişimler (yanlış kod, cihaz uyuşmazlığı) tek başına yazılmaya devam ediyor.
  - **`ipHash` bu adımda yapılmadı → F9.2'ye taşındı.** `defineSecret` emülatörde `functions/.secret.local` gerektiriyor (git'e girmez, CI ve yeni oturumlar için ek kurulum demek). Hız sınırıyla birlikte F9.2'de ele alınacak.
  - **Sunucu davranış değişiklikleri:**
    - Takma ad parametreler reddediliyor (`dynamicCode` → `invalid-argument`).
    - İstemcinin `webAuthnVerified` beyanı yok sayılıyor; yöntem her zaman sunucunun doğruladığı `qr+device_bound` (C2'nin "sahte biyometrik etiket" kısmı kapandı).
    - Sınav soruları F1.2 ortak şemasından normalize edilmiş geliyor; `sanitizeQuestion` silindi.
    - Geçmiş `closesAtMs` reddediliyor.
    - `startQuizAttempt` denetim kaydı transaction içinde yazılıyor.
  - **Testler (functions toplam 26):**
    - `guards.test.ts` (10): güvenli varsayılan, C5, bekleyen/profilsiz kullanıcı, claim'de admin ama dokümanda user, `tokensValidAfter`, App Check/MFA/e-posta zorunlulukları, önce yetki sonra doğrulama, Türkçe `invalid-argument`.
    - `attendance.test.ts` (7): başlat → kod → yoklama, log, sayaç, denetim kaydı, tekrar (idempotent), sahte biyometrik beyan, yanlış kod, eski parametre adları, cihaz bağı ve aynı cihaz, ikinci canlı ders, bitir, asistanın kod isteği, mazeret.
    - `quiz.test.ts` (4): **repodaki örnek CSV** ile taslak → yayın → giriş → devam → teslim (puan 67, Türkçe harf duyarsız eşleşme), cevap anahtarının public sorulara karışmaması, önizlemeyle aynı kuralla satır numaralı ret, geçmiş kapanış, yeni yayının öncekini arşivlemesi.
    - Her başarılı yanıt `CALLABLES[...].response` ile doğrulanıyor.
  - **Emülatör çalışma ortamında uçtan uca doğrulandı (istemci SDK'sı → Functions emülatörü):** seed admin ders başlattı, kod aldı; seed asistan yoklama verdi; asistanın kod isteği `permission-denied`; geçersiz istek Türkçe `invalid-argument`; askıdaki kullanıcı `permission-denied`. **F0.4'teki "callable'lar emülatörde çağrılamıyor" engeli kalktı.**
  - Doğrulandı: lint, format, typecheck, no-mock, unit 49, functions 26, rules 15 + 4 `it.fails`, e2e 6, functions ve next build.

#### F1.4 İstemci çağrı katmanı (S)
- **Dosyalar:** `src/lib/firebase/callables.ts`, `src/lib/errors.ts`, `src/hooks/useAsyncAction.ts`
- **Yapılacaklar:**
  - `callable(name, ReqSchema, ResSchema)` yanıtı zod ile doğrular. Hata durumunda `AppError {code, message}` fırlatır. `toUserMessage` Türkçe kod eşlemesine genişletilir.
  - `useAsyncAction` hook'u `{run, pending, error, data, reset}` döndürür.
  - `getOrCreateClientDeviceSecret` F4.2'de silinir.
  - `invokeWithFallback` `@deprecated` olarak işaretlenir. Modül fazlarında çağrı yerleri tek tek kaldırılır, F7.5'te tamamen silinir.
- **Doğrulama:** typecheck + `tests/unit/callables.test.ts` (hata eşleme).
- **✅ Uygulanan (2026-11-10) — plandan sapmalar:**
  - **`callFunction(name, data)`:** tipler `CALLABLES`'tan. İstek **göndermeden önce** aynı şemayla doğrulanıyor (geçersiz istek ağa çıkmaz, sunucuyla birebir aynı Türkçe mesaj) ve normalize edilmiş hali gönderiliyor. Yanıt, yanıt şemasıyla doğrulanıyor; uyumsuzlukta `bad-response` (konsola ayrıntı yazılır). 11 adlandırılmış çağrı `bind(name)` ile üretiliyor. Eski dosyadaki uydurma yanıt alanları (`ok?`, `expiresAtMs?`, `secondsUntilRotation?`, `attemptId?`…) kalktı.
  - **`src/lib/errors.ts`:** `AppError` + `toAppError` / `toUserMessage`. Sunucu mesajı yalnızca kullanıcıya uygun kodlarda gösteriliyor; `internal`/bilinmeyen kodlarda teknik mesaj **gösterilmiyor**. Ağ hataları `unavailable`. `formatIssues` istemci/sunucu ortak kullanım için `functions/src/shared/issues.ts`'e taşındı.
  - **`src/hooks/useAsyncAction.ts`:** `pending` / `error` (Türkçe) / `data`, çift tıklama koruması, kaldırılmış bileşende state güncellenmez.
  - **`invokeWithFallback` silinmedi**, `@deprecated` geçiş katmanı olarak kaldı (çağrı yerleri mock sayfalarda; F4–F7'de kalkacak, F7.5'te silinecek). Tipi gevşetildi (`fallbackFn: () => unknown`). Hatayı yutmadan önce artık **konsola yazıyor**. Bekçi yeni kullanımı engelliyor.
  - `getOrCreateClientDeviceSecret`: `Math.random` yedeği ve sunucuda sahte değer döndürme kaldırıldı (`crypto.getRandomValues` zorunlu); `@deprecated`, F4.2'de WebAuthn ile değişecek.
  - **Tiplerin yakaladığı uyumsuzluklar:** admin sayfasındaki kıdem yılı (`number` → `ResidencyYear`) ve yoklama sayfasının eski parametre adları (`dynamicCode`/`clientDeviceSecret`/`webAuthnVerified` → `code`/`deviceId`). İkisi de düzeltildi. **F1.3 ↔ istemci uyumu tamamlandı.**
  - **Tek zod kopyası kanıtlandı (kontrol deneyiyle):** alias yokken ve istemci doğrudan `zod` import ettiğinde pakette **2** kopya, alias varken **1** kopya.
  - Bekçinin `FALLBACK_*` deseni yeni `FALLBACK_MESSAGES` sabitini yakaladı (yanlış pozitif). Bekçi gevşetilmedi; sabit `DEFAULT_ERROR_MESSAGES` olarak yeniden adlandırıldı.
  - Yeni devDependencies: `jsdom`, `@testing-library/react`, `@testing-library/dom` (hook testleri; F3.1 UI testleri de kullanacak). Dosya bazında `// @vitest-environment jsdom`.
  - Testler (unit toplam 64): `errors.test.ts` (5), `callables.test.ts` (6: ağa çıkmadan ret, normalize gönderim, `bad-response`, sunucu hatası eşleme, `not-configured`, deprecated katmanın konsola yazması), `useAsyncAction.test.ts` (4).
  - Doğrulandı: lint, format, typecheck, no-mock, unit 64, functions 26, rules 15 + 4 `it.fails`, e2e 6, iki build.

---

### F2 — Yetkilendirme temeli

#### F2.1 Firestore kuralları (L)
- **Dosyalar:** `firestore.rules`, `firestore.indexes.json`, `tests/rules/*.test.ts`
- **Kurallar:**
  - `userDoc()` = `get(users/uid).data`.
  - `isActive()` = `userDoc().status=='active' && request.auth.token.auth_time > userDoc().get('tokensValidAfter', 0)`.
  - `isAdmin()` = `isActive() && userDoc().role=='admin'`.
  - `users/{uid}`: sahibi veya admin okur. İstemci `create/update/delete` → **hayır** (D4). Admin alan güncellemeleri de callable üzerinden yapılır.
  - `clinic_members` silinir.
  - `invitations`: yalnızca admin okur, yazımlar yalnızca callable üzerinden.
  - `materials`: aktif üye okur, yazım callable ile (F6).
    - `progress/{uid}`: `isActive() && isOwner(uid)`, `keys().hasOnly(['uid','secondsSpent','lastPage','completed','updatedAt'])` ve tip/aralık kontrolleri.
    - Admin raporu için `match /{path=**}/progress/{uid}` collectionGroup okuma kuralı.
  - `quizzes`: aktif üye `published|closed` okur.
    - `questions_public`: **istemciye kapalı**, sadece admin okur. Hekime sorular `startQuizAttempt` ile gelir (C7).
  - `quiz_attempts`: sahibi ve admin okur. Liste sorgusu `where uid==auth.uid` zorunlu. Doküman hassas alan içermez (F5.1).
  - `quiz_attempt_drafts/{attemptId}`: yazım callable ile yapılır.
  - `attendance_sessions`, `attendance_logs`, `attendance_secrets`, `audit_logs`, `quiz_answer_keys`, `quiz_question_archive`: mevcut kapalılık korunur; okuma koşulları `isActive` / `isAdmin` ile güncellenir.
  - `webauthn_challenges`: tamamen kapalı.
  - `stats`, `calculators_config`: aktif üye okur, yazım admin/callable ile.
- **Rules testleri (minimum):**
  - Askıdaki kullanıcı, taze token ile bile reddedilir.
  - `auth_time < tokensValidAfter` olan token reddedilir.
  - Bekleyen kullanıcı hiçbir modül verisini okuyamaz.
  - Hekim `questions_public`'i okuyamaz.
  - Hekim başka hekimin `quiz_attempts`/`attendance_logs` kaydını okuyamaz; filtresiz liste sorgusu reddedilir.
  - İstemci `users` oluşturamaz/güncelleyemez.
  - `progress` ekstra alan veya başkasının uid'i ile yazılamaz.
  - Davetleri admin olmayan okuyamaz.
  - Admin her şeyi okuyabilir; istemci yazımları hep reddedilir.
- **`it.fails` → `it`:** `tests/rules/firestore.test.ts` içindeki C5, C7 ve C9 testleri bu adımda normal teste çevrilir.
- **Doğrulama:** `npm run test:rules`
- **✅ Uygulanan (2026-11-10) — plandan sapmalar:**
  - `isActive()` = profil var + `status == 'active'` + `auth_time > tokensValidAfter` (yoksa 0); `isAdmin()` = `isActive()` + `role == 'admin'`. Claim'lere hiç bakılmıyor (testlerde claim'ler bilerek dokümanla çelişecek şekilde verildi).
  - **C5, C7, C9 kural katmanında kapandı;** üç `it.fails` testi `it`'e çevrildi. C7'nin ikinci yarısı (teslim edilen girişimdeki `gradedReport` sınav kapanmadan doğru cevapları içeriyor) kuralla çözülemez → F5.1 `revealPolicy` (kural dosyasında not var).
  - **`users` create kuralı kapatılmadı, sıkılaştırıldı** (F1.4 devir uyarısı): yalnızca kendi uid'i, `hasOnly`/`hasAll` alan listesi, `role == 'user'`, `status == 'pending'`, `email == token.email`, ünvan listesi, ad 2–120, kıdem 1–4, davet kodu null/≤64, `mfaEnabled == false`, `boundDeviceHash == null`, `createdAt == request.time`. **F2.3'te `completeRegistration` ile birlikte tamamen kapatılacak.** `users` update/delete herkese (admin dahil) kapalı.
  - `clinic_members` kaldırıldı (varsayılan kapalı). `invitations`: yalnızca admin okur.
  - Materyal ilerlemesi: sahibi + aktif, `hasOnly`/`hasAll` 5 alan, tip ve aralık kontrolleri, `updatedAt == request.time`, silme yok. Admin için `match /{path=**}/progress/{uid}` collectionGroup okuma kuralı.
  - **`calculators_config` yazımı admin'e de kapalı** → F7.4'te callable (denetim kaydı için). F7.4 metni buna göre güncellendi.
  - Henüz kullanılmayan koleksiyonlar (`stats`, `quiz_attempt_drafts`, `webauthn_challenges`, `attendance_meta`) tanımlanmadı (varsayılan kapalı); ilgili adımlarda eklenecek.
  - **MFA / e-posta doğrulaması kurallarda yok:** kurallar functions parametrelerini okuyamaz. Zorunluluk callable'larda (`guards.ts`). F3.4'te gerçek MFA gelince salt-okuma veriler için kurallara `sign_in_second_factor` eklenip eklenmeyeceği değerlendirilecek (emülatör kuralları ayrı tutulmalı).
  - **Test aracı bulgusu:** `@firebase/util` sahte token'ında `iat` verilmezse `auth_time` = 0 (1970) oluyor ve yeni kural her aktif kullanıcıyı reddediyordu. Kural doğru, gerçek token'larda `auth_time` her zaman oturum açma anı. Çözüm: `tests/rules/helpers.ts → claimsOf` gerçek `iat`/`auth_time` veriyor. Önce `sessionNotRevoked()` geçici olarak devre dışı bırakılıp sorun yalıtıldı.
  - Testler: **rules 32 + 1 `it.fails`** (C11 → F2.2). Kapsam: doküman ile claim çelişkisi, profilsiz oturum, `tokensValidAfter`, kendi profilini okuma, profil güncelleme yasağı, geçici kayıt kuralı (geçerli biçim, admin/aktif, ek alan, başka e-posta/uid, istemci zamanı, ünvan/kıdem/ad), kişisel veri izolasyonu (yoklama logu, canlı/geçmiş ders, kayıtlar, girişimler), sınav gizliliği (anahtar, arşiv, sorular, taslak, filtreli liste), ilerleme şeması ve collectionGroup, denetim kaydı, istemci yazımları, davetler, hesaplayıcı notları, tanımsız koleksiyon.
  - **E2E kayıt regresyon testi** (`e2e/registration.spec.ts`) + `e2e/fixtures/emulator.ts` (emülatör REST'iyle profil doğrulama). Gerçek kayıt ekranı sıkılaştırılmış kuralla çalışıyor ve profil `pending` olarak doğru alanlarla oluşuyor. Not: sayfadaki boş `role="alert"` Next.js'in rota duyurucusu, hata değil. E2E toplam 8.
  - Doğrulandı: lint, format, typecheck, no-mock, unit 64, functions 26, rules 32 + 1, e2e 8, next build.

#### F2.2 Storage kuralları (S)
- **Dosyalar:** `storage.rules`, `tests/rules/storage.test.ts`
- **Yapılacaklar:**
  - Yetki `firestore.get(/databases/(default)/documents/users/$(request.auth.uid))` ile doküman üzerinden kontrol edilir (D3). Deploy sırasında cross-service IAM izni onaylanmalı; `DEPLOY.md`'ye not düşülür.
  - `materials/{materialId}/{file}`: `read` aktif üye. `create, update` admin + boyut + MIME (pdf, video/*, image/*; pptx yok, D19). `delete` admin.
  - `quiz_media/{file}`: `read` aktif üye. `create` admin + image/* + ≤15 MB. `delete` admin.
- **`it.fails` → `it`:** `tests/rules/storage.test.ts` içindeki C11 testi bu adımda normal teste çevrilir.
- **Doğrulama:** `npm run test:rules`
- **✅ Uygulanan (2026-11-10) — plandan sapmalar:**
  - Yetki Firestore `users/{uid}`'den `firestore.get` / `firestore.exists` ile okunuyor; `isActive` ve `isAdmin` Firestore kurallarıyla aynı mantıkta (`tokensValidAfter` dahil). Claim'lere bakılmıyor. Çapraz okumanın emülatörde gerçekten çalıştığı "aktif üye okur" testiyle kanıtlandı.
  - **pptx kabul edilmiyor (D19):** tarayıcı görüntüleyemez, filigran uygulanamaz; sunumlar PDF olarak yüklenir. **SVG kabul edilmiyor** (içinde betik çalışabilir). Materyal: pdf, video (mp4/webm/quicktime), görsel (png/jpeg/webp), <150 MB. Sınav görseli: png/jpeg/webp/gif, <15 MB.
  - Yol `materials/{materialId}/{fileName}` (tek seviye; iç içe yol yasak). Listelenmeyen yollar kapalı.
  - **C11 kapandı:** `create, update` (boyut/tür kontrollü) ve `delete` (yalnızca admin) ayrıldı. Kök neden: silmede `request.resource` null olduğu için `request.resource.size` hata veriyordu.
  - **Sapma önleme:** izinli türler ve boyutlar ortak sabitlerde (`MATERIAL_UPLOAD`, `QUIZ_MEDIA_UPLOAD`; F6 yükleme arayüzü `accept`/boyut kontrolü için kullanacak). `tests/unit/storageRulesSync.test.ts` kural dosyasındaki desenleri ve boyutları okuyup sabitlerle **iki yönlü** eşleştiriyor. Kuralda boyut 15→20 ve SVG eklenerek testin kırmızıya döndüğü doğrulandı.
  - Testler: **rules 42 (sıfır `it.fails` kaldı)**, Storage'da 13 test: okuma, claim ile doküman çelişkisi, C5 (Storage), `tokensValidAfter`, admin/asistan yükleme, yasak türler, C11 silme, iç içe yol, sınav görseli türleri, 15 MB sınırı, tanımsız yollar. Unit 67.
  - Deploy notu (F9.3 `DEPLOY.md`): Storage → Firestore çapraz erişimi için CLI, Storage servis hesabına IAM izni ister; onaylanmalıdır.
  - Doğrulandı: lint, format, typecheck, no-mock, unit 67, rules 42, functions 26, e2e 8.

#### F2.3 Kimlik sunucu tarafı (L)
- **Dosyalar:** `functions/src/authTriggers.ts` → `functions/src/members.ts`, `functions/src/index.ts`, `functions/test/members.test.ts`
- **Yapılacaklar:**
  - `onClinicMemberCreated` → `syncUserClaims` olarak yeniden adlandırılır (`onDocumentWritten`). **`tokensValidAfter` epoch SANİYE olarak yazılır** (F1.3 `guards.ts` bunu `auth_time` ile karşılaştırıyor). `updateMemberAccess` de askıya alma, rol düşürme ve cihaz sıfırlamada aynı alanı yazmalı. `status` veya `role` değişince claim'leri günceller, `revokeRefreshTokens` çağırır ve `tokensValidAfter = now()` yazar.
  - `completeRegistration` (callable, idempotent):
    - Token'dan email alınır.
    - İstemciden gelen alanlar: `title`, `fullName`, `residencyYear`, `inviteCode?`, `consentVersion`.
    - Davet geçerliyse (`email` eşleşir, süresi dolmamış, kullanılmamış): `status:'active'` ve davetteki rol. Değilse `status:'pending'`.
    - Davet transaction içinde `used=true` yapılır. Denetim kaydı yazılır.
  - `updateMemberAccess` korumaları:
    - Hedef kullanıcı mevcut mu (`getUser`).
    - Kendi rolünü/durumunu değiştirme yasak.
    - Son aktif admin düşürülemez.
    - `residencyYear` 1–4.
    - Yeniden aktivasyon ve onay ayrı `action` değerleriyle yapılır.
  - `createInvitation` / `revokeInvitation` callable'ları.
- **Testler:** davetli/davetsiz kayıt, tekrar çağrı (idempotent), son admin koruması, kendini düşürme, olmayan uid, askıya alınca `tokensValidAfter` yazılması.
- **✅ Uygulanan (2026-11-10) — plandan sapmalar:**
  - `functions/src/authTriggers.ts` → **`functions/src/members.ts`**. `onClinicMemberCreated` → **`syncUserClaims`**: claim'leri dokümanla eşitliyor; yetki düşüşünde `revokeRefreshTokens` ve `tokensValidAfter` (callable aynı yazımda yazmadıysa); yalnızca başka alanlar değiştiyse çıkıyor (döngü yok); profil silinince oturumları kapatıp claim'leri temizliyor; her claim değişikliği `MEMBER_CLAIMS_*` denetim kaydı (aktör `system`; konsol değişiklikleri de iz bırakıyor).
  - **`updateMemberAccess`:**
    - Kendi rolünü/durumunu değiştirme yasak.
    - Hedef Auth'ta ve profilde yoksa `not-found` (eskiden rastgele uid için profil oluşturuyordu).
    - Transaction içinde son aktif admin sayımı.
    - Yalnızca yetki düşüşü ve cihaz sıfırlamada `tokensValidAfter` + iptal (eskiden "pending" kullanıcının kıdemini değiştirmek bile oturumu iptal ediyordu).
    - `updatedBy`; `approvedBy` yalnızca aktifleştirmede.
    - Denetim kaydı transaction içinde ve önceki değerleri içeriyor.
  - **Son admin koruması hakkında doğru tespit:** sıralı akışta erişilemez (isteği yapan da aktif admin olmak zorunda, kendini değiştirme de yasak). Gerçek işlevi **eşzamanlı** karşılıklı düşürmede sistemin admin'siz kalmasını önlemek. Test buna göre yazıldı (iki istek aynı anda → yalnızca biri başarılı, 1 aktif admin kalıyor; üç tekrarda kararlı). Koruma kapatılınca testin kırmızıya döndüğü doğrulandı. İlk yazdığım dört karışık test silindi.
  - **`completeRegistration`** (`defineCallable`'a yeni erişim seviyesi `"signedIn"` + `guards.ts → requireSignedIn`):
    - İdempotent; e-posta token'dan (küçük harf), rol ve durum istemciden alınmıyor.
    - Davet kodu transaction içinde doğrulanıp tüketiliyor; kodun kullanılmamış, iptal edilmemiş, süresi dolmamış ve aynı e-postaya ait olması gerekiyor.
    - Geçerli davette rol ve kıdem davetten, durum doğrudan `active`. **Geçersiz kodda kayıt hata veriyor**: sessizce "pending" olmuyor, kullanıcı düzeltebiliyor.
    - Claim hemen yazılıyor; denetim kaydı `MEMBER_REGISTERED`.
    - **`consentVersion` şimdilik isteğe bağlı:** F3.5'te KVKK onay kutusuyla zorunlu olacak. Kullanıcının vermediği bir onayı kaydetmek uydurma veri olurdu.
  - **`createInvitation` / `revokeInvitation`** (admin): kod `PED-` + 8 karakter (karışıklık yaratan harfler yok, `crypto.randomBytes`), çakışma kontrolü, kayıtlı üyenin e-postasına davet yasak, kullanılmış davet iptal edilemez. `InvitationDoc`'a `revoked*` alanları eklendi; seed daveti `revoked: false` içeriyor.
  - **Kayıt kuralı kapatıldı** (`users` create/update/delete herkese kapalı). Kayıt ekranı aynı adımda `createUserWithEmailAndPassword` → `completeRegistration` akışına geçti. Yarım kalmış kayıtta (hesap açık, profil yok) hesabı yeniden açmaya çalışmadan profili tamamlıyor. Etkin davette `/dashboard`'a, değilse `/pending`'e gidiyor. **Firebase yapılandırılmamışken "başarılı" sayılıp yönlendirme yapılması** (eski sahte başarı) kaldırıldı.
  - `src/lib/errors.ts`: Firebase **Auth** hata kodları (e-posta kullanımda, zayıf şifre, hatalı kimlik bilgisi, çok fazla deneme, ağ vb.) Türkçe; bilinmeyen kodda teknik mesaj gösterilmiyor.
  - **N6 (e2e ile bulundu ve düzeltildi):** bkz. §7. `callFunction` artık göndermeden önce `undefined` alanları ayıklıyor (`stripUndefined`).
  - İstemciye `completeRegistration`, `createInvitation`, `revokeInvitation` çağrıları eklendi. Yeni birim testi, `CALLABLES`'taki her sözleşmenin istemcide aynı adlı bir çağrısı olmasını zorunlu kılıyor (bu adımda bir eksik böyle fark edildi).
  - Testler:
    - Functions 44: `members.test.ts` 23 (onay, askı + `tokensValidAfter`, cihaz sıfırlama, kendini değiştirme, olmayan kullanıcı, geçersiz kıdem, eşzamanlı son admin; kayıt: davetsiz, rol/durum enjeksiyonu, idempotent, geçerli davet, 4 geçersiz davet türü, olmayan kod sonrası kodsuz kayıt, oturumsuz, e-postasız; davet oluşturma, yetki, kayıtlı e-posta, iptal; claim senkronu: ilk yazım, konsoldan askı, döngü yok).
    - Rules 40: kayıt bloğu "istemci profil oluşturamaz" olarak güncellendi.
    - Unit 70.
    - **E2E 12:** davetsiz, davetli (doğrudan aktif, panel, davet tüketildi), geçersiz kod (Türkçe hata, kodsuz tekrar denemede hesap yeniden açılmadan tamamlanıyor); her biri masaüstü ve telefonda. `e2e/fixtures/emulator.ts`'e `writeDocument` / `readDocument` eklendi.
  - Doğrulandı: lint, format, typecheck (iki paket), no-mock, unit 70, rules 40, functions 44, e2e 12, next build.

#### F2.4 Oturum bağlamı (M)
- **Dosyalar:** `src/lib/auth/ClinicSessionContext.tsx`
- **Yapılacaklar:**
  - `onIdTokenChanged` + `onSnapshot(users/uid)` birlikte çalışır.
  - Profil eksikse `completeRegistration` yeniden çağrılır (yarım kalmış kayıt kurtarma).
  - Doküman ile claim'ler uyuşmazsa `getIdToken(true)`.
  - Durum `suspended` olursa anında `signOut` ve bilgi ekranı.
  - Etkin durum **yalnızca dokümandan** okunur (D3).
  - `appCheckVerified`, `mfaVerified` gibi sahte alanlar kaldırılır.
  - `mfaEnrolled` gerçek `multiFactor(user).enrolledFactors` değerinden gelir.
  - `clinic_members` okuması silinir.
- **Doğrulama:** e2e (F3.5'te yazılır): admin onaylayınca bekleyen kullanıcının ekranı yenilemeden aktif duruma geçer.
- **✅ Uygulanan (2026-11-10) — plandan sapmalar:**
  - **Karar mantığı saf fonksiyonda:** `src/lib/auth/sessionDecision.ts → evaluateSession(profile, token)`. Çıktısı `needsProfile` / `signOut(askida | oturum-sonlandi)` / `ready(role, status, refreshClaims)`. Rol ve durum yalnızca dokümandan; geçersiz değerler en düşük yetkiye indirgeniyor. Askıda veya `auth_time <= tokensValidAfter` ise oturum kapanıyor. 7 birim testi.
  - **Bağlam** (`ClinicSessionContext.tsx`): `onIdTokenChanged` + kendi profilinin `onSnapshot`'ı. Fazlar `loading | signedOut | signingOut | needsProfile | ready | error`; geriye uyumlu `session` ve `loading` alanları korunuyor. Claim önbelleği dokümandan farklıysa token **(uid, rol, durum) başına bir kez** yenileniyor (tetikleyici çalışmazsa yenileme → `onIdTokenChanged` → yeniden abonelik döngüsüne girmemek için). Firebase yapılandırılmamışsa "error" fazı (sessiz boş oturum yok). `clinic_members` okuması silindi.
  - **`ClinicMemberSession`:** `appCheckVerified` (her zaman `true` yazılıyordu) **kaldırıldı**. `mfaVerified` token'daki `signInSecondFactor`'dan; yeni `mfaEnrolled` `multiFactor(user).enrolledFactors`'tan. Mock sayfaların `FALLBACK_*` oturumları buna göre güncellendi; bu sayfalar zaten izin listesinde.
  - **Korumalı layout:** `needsProfile` → `/register` (kayıt ekranı açık oturumu algılayıp yalnızca profili tamamlıyor); `error` → mesaj ve "Tekrar dene"; `signingOut` → "Oturum kapatılıyor…".
  - **Giriş ekranı** `?neden=askida | oturum-sonlandi` için Türkçe bilgi kutusu gösteriyor (`role="status"`).
  - **E2E ile bulunan yarış durumu:** nedenli oturum kapatmada `signOut()` → `onIdTokenChanged(null)` → "signedOut" → layout'un **nedensiz** `/login` yönlendirmesi, nedenli yönlendirmeyi eziyordu. Çözüm: `signingOut` ref'i ve fazı; o sürede "signedOut" bastırılıyor.
  - **E2E `session.spec.ts` (iki tarayıcı bağlamı, seed'i bozmadan kendi kullanıcısını oluşturuyor):** kayıt → onay bekleme ekranı → admin **kendi tarayıcısında** admin panelinden onaylıyor → asistanın ekranı **yenilenmeden** panele geçiyor → admin cihaz eşleşmesini sıfırlıyor → asistanın oturumu `?neden=oturum-sonlandi` ile kapanıyor → yeniden giriş → admin askıya alıyor → oturum `?neden=askida` ile kapanıyor ve profil `suspended`. İki ardışık çalıştırmada kararlı. Kayıt formu yardımcısı `e2e/fixtures/registration.ts`'e taşındı; `loginAs` şifre parametresi alıyor.
  - **Kapsam dışı (F3.5):** `/pending` sayfası korumalı layout dışında olduğu için canlı dinlemiyor; kayıt sonrası orada bekleyen kullanıcı onaylanınca otomatik geçmiyor (panelde bekleyen kullanıcı geçiyor).
  - Doğrulandı: lint, format, typecheck, no-mock, unit 77, rules 40, functions 44, e2e 14 (iki kez), next build.

#### F2.5 CSP ve bölge (S)
- **Dosyalar:** `next.config.ts`, `firebase.json`
- **Yapılacaklar:**
  - `connect-src` için `https://*.cloudfunctions.net` ve `https://content-firebaseappcheck.googleapis.com` eklenir. Emülatörde (`NEXT_PUBLIC_USE_EMULATORS`) `http://localhost:*` ve `ws://localhost:*` eklenir.
  - `frame-src https://www.google.com https://recaptcha.google.com` eklenir.
  - `media-src 'self' blob: https://firebasestorage.googleapis.com` eklenir.
  - `worker-src 'self' blob:` eklenir (pdf.js).
  - `img-src`'ye `data: blob:` korunur.
  - `firebase.json` içindeki `hosting.headers` silinir. `hosting.frameworksBackend.region = "europe-west1"` eklenir.
  - Nonce tabanlı `script-src` F8.2'de değerlendirilir.
- **Doğrulama:** `npm run build && npm start`: tarayıcı konsolunda CSP ihlali yok, callable istekleri emülatöre gidiyor.
- **✅ Uygulanan (sapmalar ve eklemeler):**
  - **Tek kaynak `config/securityHeaders.ts`** (D9): `next.config.ts` → `headers()` yalnızca `buildSecurityHeaders({ isDev, useEmulators, projectId })` çağırır. `firebase.json` → `hosting.headers` silindi (Firebase webframeworks Next'in `routes-manifest` başlıklarını Hosting'e aktarır). `hosting.frameworksBackend.region = "europe-west1"`; ortak `REGION` ile eşitliği birim testinde.
  - **Üretim izin listesi joker yerine gerçekten kullanılan uç noktalardan:** `https://*.googleapis.com` ve kullanılmayan Realtime Database (`*.firebaseio.com`) kaldırıldı. connect-src: identitytoolkit, securetoken, firestore, firebasestorage, content-firebaseappcheck ve **`https://europe-west1-{projectId}.cloudfunctions.net`** (proje kimliği yoksa `https://*.cloudfunctions.net`).
  - reCAPTCHA Enterprise yol kısıtlı: script `www.google.com/recaptcha/`, `www.gstatic.com/recaptcha/`; frame `www.google.com/recaptcha/`, `recaptcha.google.com/recaptcha/`.
  - Eklenenler: `media-src 'self' blob: firebasestorage`, `worker-src 'self' blob:`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `manifest-src 'self'`, `Cross-Origin-Opener-Policy: same-origin`. Permissions-Policy: `geolocation=()` (kullanılmıyor; S2 coğrafi sınır seçilirse açılır); `screen-wake-lock`, `fullscreen` (F4.3) ve `publickey-credentials-*` (F4.2) `self`.
  - **`apis.google.com` kaldırıldı:** Auth artık `initializeAuth` ile, açılır pencere ve yönlendirme çözücüsü olmadan başlatılıyor (kalıcılık sırası `getAuth` ile aynı). `getAuth()` varsayılanı Safari ve mobilde sayfa açılışında gapi betiğini ve authDomain iframe'ini yüklüyordu. Uygulama yalnızca e-posta/şifre ve TOTP kullanıyor; F3.4 bunu değiştirmez.
  - `upgrade-insecure-requests` **bilinçli olarak yok**: Hosting zaten yalnızca HTTPS (HSTS); yerelde `next start` ile aynı kökenli varlıkları bozar.
  - Google Fonts kaynakları (`fonts.googleapis.com`, `fonts.gstatic.com`) F3.1'de `next/font` ile kaldırılacak.
  - **E2E CSP bekçisi** `e2e/fixtures/test.ts`: bütün spec'ler bu `test`'i kullanır. Her bağlamda `securitypolicyviolation` olayları ve konsoldaki CSP hataları toplanır; ihlal varsa test düşer. Ek bağlamlar `guardedContext()` ile dahil edilir. `e2e/csp.spec.ts`: başlıkların üretim derlemesinde gönderildiği ve bekçinin izinsiz bir isteği gerçekten yakaladığı doğrulanır.
  - **Bekçi gerçek bir ihlal buldu (N7):** zod 4, nesne doğrulayıcılarını derlemeden önce `new Function("")` ile `eval` iznini yokluyor. Hata yakalansa bile CSP ihlali raporlanıyordu (her sayfada). Çözüm `functions/src/shared/zod.ts`: `z.config({ jitless: true })` ve Türkçe yerel ayar. **Ortak şemalar ve `validate.ts` zod'u yalnızca bu modülden alır**; ESLint `no-restricted-imports` doğrudan `zod` importunu engeller (`src/**`, `functions/src/**`).
  - Yan bulgu: Türkçe varsayılan mesajlar önceden **yalnızca functions'ta** ayarlıydı; istemci ön doğrulaması açık mesajı olmayan kurallarda İngilizce gösterebiliyordu. Artık ortak ayar her iki tarafta. Birim testiyle doğrulandı.
  - Doğrulandı: lint, format, typecheck, no-mock, unit 90, functions 44, e2e 18 (CSP bekçisi açık), next build.

---

### F3 — UI temeli ve kimlik doğrulama UX

#### F3.1 Tasarım token'ları ve UI primitifleri (L)
- **Dosyalar:** `src/styles/index.css` (veya `tokens.css` + CSS Modules), `src/components/ui/*`, `src/app/layout.tsx`
- **Token düzeltmeleri:**
  - `--status-warn*` → `--status-warning*`.
  - Alert sınıfları tek sözlük kullanır: `success | warning | critical | info`.
  - `--text-muted` ≈ `hsl(215,16%,42%)` (≥4.5:1). `--status-warning` ≈ `hsl(30,90%,30%)`. Input kenarı ≈ `hsl(214,18%,58%)` (≥3:1).
  - Odak: `:focus-visible { outline: 2px solid var(--clinical-primary); outline-offset: 2px }`.
  - `.btn:disabled` stili eklenir.
  - Mobil tıklama hedefi ≥44px.
  - Boşluk ölçeği `--space-1..8`.
  - `prefers-reduced-motion` desteği.
  - Kullanılmayan sınıflar silinir.
- **Font:** `next/font/google` ile Plus Jakarta Sans ve JetBrains Mono. `@import` ve diğer sayfalardaki tekrar CSS importları silinir.
- **Primitifler:** `Button` (loading/disabled), `Alert`, `ConfirmDialog` (odak tuzağı, Esc, başlangıç odağı), `Tabs` (role=tab, aria-selected, ok tuşları), `StatusChip`, `PageHeader`, `Card`, `EmptyState`, `DataTable` (th scope, boş durum, yükleniyor), `Field` (label, `aria-invalid`, `aria-describedby`), `Countdown` (deadline prop, kendi state'i, `role="timer"`), `Toast`.
- **Doğrulama:** `tests/unit/ui/*.test.tsx` (Tabs klavye, ConfirmDialog odak) ve kontrast değerleri betikle yeniden hesaplanır (AUDIT §6'daki python yöntemi).
- **✅ Uygulanan (sapmalar ve eklemeler):**
  - **Token'lar `src/styles/tokens.css`** (tek kaynak); `index.css` iskelet/eski sınıflar, `ui.css` primitif parçaları. Kök layout üçünü bir kez import eder; login/register/korumalı layout'taki tekrar importlar silindi.
  - Kontrast düzeltmeleri: `--text-muted` `hsl(215,16%,42%)` (5.65:1), `--status-warning` `hsl(30,90%,30%)` (5.80:1), `--border-strong` `hsl(214,18%,58%)` (3.20:1). Yeni: `--text-on-accent`, `--status-*-border`, `--status-info*`, `--focus-ring`, `--focus-ring-on-dark` (koyu kenar çubuğunda 8.56:1), `--space-1..8`, `--tap-target: 44px`.
  - **Kontrast bir birim testi** (`tests/unit/ui/contrast.test.ts`): değerleri `tokens.css`'ten okuyup 19 metin (≥4.5) ve 5 kontrol/odak (≥3) çiftini hesaplar. Eski değerlerle denendi, 4 çifti düşürüyor. Aynı dosya **tanımsız `var(--…)` kullanımını** `src/**/*.css|tsx` genelinde yasaklar (`--status-warn` hatası bir daha olamaz).
  - **Tek durum sözlüğü** `success | warning | critical | info`: `.sec-chip` (`verified/warn/primary` → `success/warning/info`) ve `.clinical-alert` (`ok/warn/err` → `success/warning/critical`) 19 dosyada mekanik olarak taşındı; eski sınıflar CSS'ten silindi. `DoctorRealTimeCheckIn`'in `success/critical` kullanımı artık stilli.
  - Odak: `:focus-visible` 2 px halka (koyu kenar çubuğunda açık renk); input `:focus` gölgesi kaldırıldı. `aria-invalid` ve `disabled` kontrol stilleri, `.btn:disabled` / `[aria-busy]`, `.btn-ghost`, `pointer: coarse` cihazlarda bütün kontroller ≥44 px, `prefers-reduced-motion`, `.sr-only`. Kullanılmayan `.security-topbar`, `.security-indicators`, `.nav-badge` silindi.
  - **Yazı tipi:** `next/font/google` (Plus Jakarta Sans, JetBrains Mono; `latin` + `latin-ext` Türkçe için), CSS değişkenleri `--font-jakarta` / `--font-jetbrains`. Dosyalar derlemede indirilip `/_next/static/media`'dan sunuluyor; **CSP'den `fonts.googleapis.com` ve `fonts.gstatic.com` çıkarıldı** (birim testinde). Not: derleme Google Fonts'a erişebilmeli (CI'da var); erişim yoksa `@fontsource-variable/*` alternatifi.
  - **Primitifler `src/components/ui/`** (barrel `index.ts`): `Button`, `Alert`, `StatusChip`, `Card`, `PageHeader`, `EmptyState`, `Field`, `Tabs`, `Dialog`, `ConfirmDialog`, `DataTable`, `Countdown`, `Toast` (`ToastProvider` kök layout'ta).
    - `Button`: varsayılan `type="button"`; **hydration'a kadar gerçekten `disabled` (N3, `useHydrated`)**; `loading` sırasında `disabled` yerine `aria-disabled` + `aria-busy` (odak kaybolmaz), tıklama ve form gönderimi engellenir.
    - `Dialog`: portal, odak tuzağı, başlangıç odağı, kapanınca odağı geri verme, arka planı `inert` yapma, Esc, kaydırma kilidi; arka plana tıklama kapatmaz. `ConfirmDialog`: `alertdialog`, başlangıç odağı "Vazgeç", işlem sürerken Esc ve Vazgeç kapalı, başarıda kapanır, hatada Türkçe hata ile açık kalır (iyimser başarı yok).
    - `Tabs`: WAI-ARIA (roving tabindex, ←/→ döngüsel, Home/End, devre dışı atlanır, kontrollü/kontrolsüz, `keepMounted`).
    - `Countdown`: sunucu `deadlineMs` + `clockOffsetMs`; kendi state'i; `role="timer"` her saniye duyurulmaz, eşiklerde (varsayılan 5 dk, 1 dk) ayrı kibar canlı bölge; açılışta geçilmiş eşikler duyurulmaz; arka planda atlanan eşiklerden yalnızca en yakını; `onExpire` bir kez.
    - `DataTable`: caption zorunlu, `th scope`, satır başlığı, yükleniyor/hata/boş durumlarında eski satır gösterilmez. `Field`: render-prop ile `id`, `aria-invalid`, `aria-describedby` (ipucu + hata).
    - `Toast`: iki canlı bölge baştan DOM'da (kibar/acil); critical kendiliğinden kapanmaz.
  - **N3 uygulandı:** login ve register gönder butonları `Button`. e2e yardımcıları `networkidle` yerine **gönder butonunun etkinleşmesini** bekliyor; smoke testi sunucu HTML'inde butonun `disabled` olduğunu ve hydration sonrası etkinleştiğini doğruluyor.
  - Vitest: unit projesine `oxc.jsx.runtime = "automatic"` (tsconfig `jsx: preserve`) ve DOM temizleyen `tests/unit/setup.ts`.
  - E2E değişikliği: bildirim bölgesi de `role="status"` olduğu için `session.spec.ts` durum mesajını metinle süzerek arıyor.
  - **Kapsam notu:** mevcut (mock) sayfalar primitiflere toplu taşınmadı; her sayfa yeniden yazıldığı fazda (F3.2–F7) primitiflere geçer ve satır içi stiller o sırada temizlenir.
  - Doğrulandı: lint, format, typecheck, no-mock, unit 140, functions 44, e2e 20, next build; giriş sayfası ekran görüntüsüyle (odak halkası, uyarı rengi, Türkçe glifler) kontrol edildi.

#### F3.2 Korumalı layout (M)
- **Dosyalar:** `src/app/(protected)/layout.tsx`, `src/components/nav/*`, `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/(protected)/loading.tsx`
- **Yapılacaklar:**
  - `next/link` + `usePathname` ile `aria-current="page"` ve `.active` sınıfı.
  - ≤960px'te hamburger + çekmece (veya alt sekme çubuğu).
  - Tüm sayfalardan "Modül X • /route" çipleri kaldırılır.
  - Oturum yokken yönlendirme `router.replace` ile yapılır.
- **Doğrulama:** e2e `nav.spec.ts` (390px ve 1280px).
- **✅ Uygulanan (sapmalar ve eklemeler):**
  - **`src/components/nav/`**: `navItems.ts` (menü sırası/etiketleri tek yerde, rol bazlı etiket, `isActivePath` alt yolları da eşler ama `/quizzes-old` gibi önekleri eşlemez), `AppShell.tsx` (kenar çubuğu, mobil üst çubuk + çekmece, kullanıcı alanı, çıkış), `ErrorPanel.tsx`.
  - Menü etiketlerinden numaralar kaldırıldı ("1. Eğitim Materyalleri" → "Eğitim Materyalleri"; "5. Üye & Güvenlik" → "Üyeler ve Güvenlik"; hekim için "Sınavlar", admin için "Sınav Yönetimi"). Masaüstü bağlantı kimlikleri `nav-link-*`, çekmecedekiler `drawer-nav-link-*` (yinelenen id yok).
  - **Çekmece:** yeni `Drawer` primitifi. Odak/inert/Esc/kaydırma kilidi mantığı `Dialog`'dan **`useModalLayer`** kancasına taşındı; ikisi de onu kullanıyor. Çekmece Esc, "Menüyü kapat", arka plana dokunma, bağlantı tıklaması ve rota değişiminde kapanıyor. Üst çubuktaki "Menü" düğmesi `aria-expanded` / `aria-haspopup="dialog"`.
  - **"İçeriğe geç" bağlantısı** (WCAG 2.4.1) ve `main#main-content` (`tabIndex=-1`).
  - Çıkış düğmesi `Button` + `useAsyncAction`: hata ekranda gösteriliyor.
  - Korumalı layout yönlendirmeleri render sırasında `window.location.replace` yerine efektte `router.replace` (`Redirect` bileşeni). Nedenli oturum sonlandırma (F2.4) bilerek tam sayfa yönlendirmesi olarak kaldı (istemci durumu sıfırlanır).
  - **Durum sayfaları:** `app/not-found.tsx` (404 durum kodu ile), `app/error.tsx` (giriş/kayıt), `app/(protected)/error.tsx` (menü yerinde kalır), `app/global-error.tsx` (kök layout çökerse kendi html/body'si), `app/(protected)/loading.tsx`. Hata panelinde teknik ayrıntı yok, yalnızca Next `digest` hata kodu.
  - Sayfa başlıklarındaki "Modül N • /route" çipleri ve panelin "… Görünümü" süs çipi kaldırıldı. İç bağlantılar (`dashboard` kart düğmeleri, login↔register) `next/link`.
  - **Kapsam notu:** sayfa başlıkları henüz `PageHeader`'a taşınmadı ve uzun başlıklar kısaltılmadı; her sayfa yeniden yazıldığı fazda (F4–F7) ve metin sadeleştirmesi F8.1'de yapılır.
  - Testler: `tests/unit/nav/AppShell.test.tsx` (aktif öğe, rol, çekmece odak/Esc/inert, bağlantı ve rota değişiminde kapanma, çıkış hatası); `e2e/nav.spec.ts`:
    - menü geçişinde sayfa yeniden yüklenmiyor (pencere işareti korunuyor) ve `aria-current` taşınıyor (iki ekran boyutu);
    - telefonda kenar çubuğu gizli, çekmece klavyeyle açılıyor, 12 Tab'da dışarı çıkmıyor, Esc ile kapanınca odak "Menü"ye dönüyor;
    - "İçeriğe geç" ilk Tab'da görünüyor ve içeriğe atlıyor;
    - Türkçe 404;
    - oturumsuz korumalı sayfa geçmişe kayıt bırakmadan girişe yönlendiriyor.
  - `e2e/fixtures/nav.ts` → `openMenu(page)`: telefonda çekmeceyi açar. Smoke testleri id yerine rol/ad ile menüyü sorguluyor.
  - Ekran görüntüleriyle kontrol: 390 px üst çubuk + çekmece, 1280 px aktif öğe. (Geçişten hemen sonra eski öğe 150 ms renk geçişiyle sönüyor; sınıflar doğru, ölçüldü.)
  - Doğrulandı: lint, format, typecheck, no-mock, unit 146, e2e 28 (+2 bilinçli atlanan ekran boyutu testi), next build.

#### F3.3 SessionGuard (S)
- **Dosyalar:** `src/components/security/SessionGuard.tsx`, `src/lib/auth/IdleContext.tsx`
- **Yapılacaklar:**
  - Zamanlayıcı ref tabanlı olur (saniyelik re-render yok).
  - Kilitten 60 sn önce `ConfirmDialog` ile "Oturumunuz 60 sn içinde kapanacak — Devam et" uyarısı.
  - Sayfalar `useIdleExempt()` ile muafiyet ister (sınav, projektör).
  - Sekmeler arası etkinlik `BroadcastChannel` ile paylaşılır.
  - Bekleyen/askıdaki kullanıcı ekranları F3.5'e taşınır.
- **Doğrulama:** `tests/unit/SessionGuard.test.tsx` (sahte zamanlayıcı ile uyarı, muafiyet, kilit).
- **✅ Uygulanan (sapmalar ve eklemeler):**
  - **`src/lib/auth/IdleContext.tsx`** (`IdleProvider`, `useIdle`, `useIdleExempt`):
    - Son etkinlik zamanı ref'te; tek `setTimeout` bir sonraki karar anına kurulur. State yalnızca etkin ↔ uyarı geçişinde değişir (testte ölçüldü: 14 dakikada ≤2 çizim). Eski bileşen her saniye state güncelliyordu.
    - 14. dakikada uyarı, 15. dakikada `onTimeout` (bir kez).
    - **Uyarı açıkken fare/klavye hareketi süreyi uzatmaz**; yalnızca açık "Devam et" uzatır (yanlışlıkla dokunmayla oturumun sessizce uzamasını önler).
    - Sekmeler arası `BroadcastChannel("pediatrist-idle")` (5 sn kısıtlı): başka sekmede çalışan hekimin bu sekmesi kapanmaz; açık uyarı kapanır.
    - `visibilitychange` ile uyku/arka plan dönüşünde saatten yeniden hesap.
    - Muafiyet sayaçla tutulur; muafiyet başlarsa açık uyarı kapanır, bitince süre baştan başlar.
  - **Plandan sapma:** uyarı `ConfirmDialog` değil `Dialog` (`alertdialog`) + `Countdown`. "Devam et" bir sunucu işlemi değil; `ConfirmDialog`'un "işlem bitene kadar açık kal" davranışı burada anlamsız. Başlangıç odağı "Devam et"te; Esc de devam sayılır; "Şimdi çıkış yap" ikinci seçenek.
  - **Kilit = gerçek çıkış:** `signOutUser("hareketsizlik")` → `/login?neden=hareketsizlik` ("Uzun süre işlem yapılmadığı için oturumunuz kapatıldı…"). İstemcide doğrulanamayan "kilidi aç" adımı ve `onUnlock` prop'u kaldırıldı. Çıkış başarısız olsa bile sayfa giriş ekranına yönlendirilir.
  - `signOutUser(reason?)`: `signOut` hatasında oturumu "kapatılıyor" durumunda bırakmaz, hatayı fırlatır (arayüz gösterir). `SignOutReason`'a `hareketsizlik` eklendi.
  - **Muafiyetler (C8):** `ClinicalExamRunner` (sınav ekranı açıkken), `AdminLiveAttendanceProjector` (canlı ders varken). Asıl ekranlar F4.3/F5.3'te yeniden yazılınca aynı kanca taşınır.
  - **Plandan sapma:** bekleyen kullanıcı ekranı F3.5'e taşınmadı, ama kullanılabilirlik açığı nedeniyle şimdiden "Çıkış yap" düğmesi ve doğru metin aldı ("Onaylandığında bu sayfa kendiliğinden açılır": F2.4 canlı oturum sayesinde doğru). Başlık `h1`. Bekleyen kullanıcıda hareketsizlik zamanlayıcısı çalışmaz. Ayrı ekran tasarımı F3.5'te.
  - `requireAdmin` reddi `Alert` ile (henüz çağıran yok; F7'de admin sayfaları kullanacak).
  - Testler:
    - `tests/unit/auth/IdleContext.test.tsx` (9): uyarı/zaman aşımı zamanlaması ve tek çağrı; etkinlikle sıfırlama; uyarıda hareketin uzatmaması; "Devam et"; muafiyet ve bitişi; uyarıdayken muafiyet; uyku dönüşü; BroadcastChannel.
    - `tests/unit/auth/SessionGuard.test.tsx` (4).
    - Mutasyonla doğrulandı: muafiyet ve "uyarıda hareket uzatmaz" kontrolleri kaldırılınca ilgili testler düşüyor. İlk sürüm ikinci mutasyonu yakalamıyordu; test bitiş anını geçecek şekilde güçlendirildi.
    - `e2e/idle.spec.ts` (Playwright `page.clock`): 14. dakikada uyarı, odak "Devam et"te, Enter ile kapanır, tekrar uyarı, 15. dakikada `?neden=hareketsizlik` ve Türkçe mesaj.
  - Doğrulandı: lint, format, typecheck, no-mock, unit 158, e2e 30 (+2 ekran boyutuna özel atlanan), next build.

#### F3.4 Giriş ve MFA (L)
- **Dosyalar:** `src/app/(auth)/login/page.tsx`, `src/app/(auth)/reset/page.tsx`, `src/app/(protected)/account/security/page.tsx`
- **Yapılacaklar:**
  - Sahte TOTP adımı **silinir**.
  - `signInWithEmailAndPassword` sırasında `auth/multi-factor-auth-required` yakalanırsa `getMultiFactorResolver` ve `TotpMultiFactorGenerator.assertionForSignIn` akışı çalışır.
  - Hata kodları Türkçe eşlenir (yanlış şifre, çok fazla deneme, devre dışı hesap).
  - `autoComplete` öznitelikleri (`username`, `current-password`, `one-time-code`) ve `inputMode="numeric"`.
  - "Şifremi unuttum" → `sendPasswordResetEmail`.
  - `/account/security`: TOTP kaydı (`TotpMultiFactorGenerator.generateSecret` + QR + doğrulama).
  - `REQUIRE_MFA` açıkken MFA kaydı olmayan kullanıcı bu sayfaya yönlendirilir.
- **Not:** Auth emülatörünün TOTP desteği bu adımda doğrulanır. Desteklenmiyorsa MFA akışı staging'de manuel test edilir ve test senaryosu F10.3'e yazılır. e2e bu durumda `REQUIRE_MFA=false` ile koşar.
- **Doğrulama:** e2e `auth.spec.ts` (giriş, yanlış şifre mesajı, şifre sıfırlama e-postası emülatörde görünür).
- **✅ Uygulanan (sapmalar ve eklemeler):**
  - **Emülatör TOTP desteği denendi (betikle, gerçek SDK):**
    - Doğrulanmamış e-postayla kayıt `auth/unverified-email` ile reddediliyor (Identity Platform ile aynı davranış).
    - E-posta doğrulanınca `generateSecret` → `auth/invalid-argument: Missing phoneEnrollmentInfo`. **Emülatör TOTP desteklemiyor.**
    - Şifre sıfırlama e-postası emülatörde çalışıyor (`/emulator/v1/projects/{id}/oobCodes`).
    - Sonuç D5'e işlendi: e2e MFA kapalı (`NEXT_PUBLIC_REQUIRE_MFA=false`); TOTP akışı birim testleri (SDK yalnızca testte sahte) + staging (F10.3).
  - **`src/lib/auth/mfa.ts`:**
    - `isMfaRequired` (güvenli varsayılan: yalnızca açık `"false"` kapatır, N5 ile aynı).
    - `normalizeTotpCode`: 6 hane değilse sunucuya gitmeden Türkçe hata.
    - `mfaResolverFrom`, `totpHint` (hesapta yalnızca SMS varsa açık hata), `completeTotpSignIn`.
    - `startTotpEnrollment` (anahtar 4'lü gruplu, `otpauth://` issuer "Pediatrist"), `finishTotpEnrollment`, `enrolledFactors`, `unenrollFactor`.
  - **Giriş sayfası yeniden yazıldı:**
    - Sahte 6 hane adımı silindi (C4 kapandı).
    - `auth/multi-factor-auth-required` → ikinci adım; kodu Identity Platform doğrular.
    - İkinci adım oturumu dolarsa (`invalid/missing-multi-factor-session`) ilk adıma dönüp açıklıyor.
    - `Field` / `Button` / `Alert`, `autoComplete` (username, current-password, one-time-code), `inputMode` (email, numeric), "Şifremi unuttum" ve "Üyelik başvurusu yap" bağlantıları.
    - Etiketler sadeleşti: "E-posta", "Şifre", "Giriş yap".
  - **Plandan sapma, girişten sonra tam sayfa geçişi** (`src/lib/navigation.ts → hardNavigate`). İstemci tarafı geçişte (`router.replace`) klavye odağının başlangıç noktası eski formda kalıyor ve Tab "İçeriğe geç"e gitmiyordu (e2e buldu). Tam geçiş ayrıca formun durumunu bellekten atıyor.
  - **`/reset`:** `sendPasswordResetEmail`; hesap varlığını sızdırmamak için kayıtsız adreste de aynı nötr mesaj. Geçersiz adres, çok deneme ve ağ hataları gösteriliyor.
  - **`/account/security`** (korumalı):
    - Durum çipi (Etkin/Kapalı).
    - E-posta doğrulanmamışsa önce doğrulama: "Doğrulama e-postası gönder" + "Doğruladım" (`reload` + token yenileme → oturum bağlamı güncellenir).
    - Kurulum: yerelde üretilen QR (`qrcode` 1.5.4, `data:` URL; anahtar hiçbir sunucuya gitmez) + elle anahtar + kod → `enroll` → **oturum kapatılır** (`?neden=mfa-kuruldu`, olumlu tonla). Sunucu `sign_in_second_factor` istediği için kayıttan sonra yeni girişte kurulumun gerçekten çalıştığı da kanıtlanıyor.
    - Kayıtlı yöntemler listesi; MFA zorunluyken "Kaldır" yok (kaybolan telefon → admin, bkz. F7.1); zorunlu değilken `ConfirmDialog` ile kaldırma.
    - **Emülatörde kurulum düğmesi yerine dürüst açıklama** (ilk ekran görüntüsünde genel "Beklenmeyen hata" çıkıyordu).
  - **Zorunluluk:** `REQUIRE_MFA` açıkken, kaydı olmayan **etkin** üye korumalı alanda yalnızca `/account/security`'yi kullanabilir (`SECURITY_PAGE`, `navItems.ts`). Asıl zorunluluk sunucuda (`guards.ts`, F1.3). Kenar çubuğuna "Hesap güvenliği" bağlantısı eklendi.
  - Oturum: `ClinicMemberSession.emailVerified`. `SignOutReason` + `mfa-kuruldu`; `SIGN_OUT_TONES` (giriş bildirimi `success`/`warning`).
  - `src/lib/errors.ts`: MFA, yeniden giriş gereksinimi, doğrulanmamış e-posta, eylem bağlantısı ve eksik alan için 15 yeni Türkçe Auth hata eşlemesi.
  - Bağımlılık: `qrcode` 1.5.4 (+ `@types/qrcode` 1.5.5). Üretim `npm audit` değişmedi (yalnızca D15'teki 8 orta seviye `uuid` zinciri).
  - Testler:
    - `tests/unit/auth/mfa.test.ts` (9), `LoginPage.test.tsx` (6: otomatik doldurma, yanlış şifre, MFA adımı odağı, yanlış/doğru kod, eksik kod sunucuya gitmez, ikinci adım süresi dolunca dönüş, olumlu bildirim), `AccountSecurityPage.test.tsx` (5: QR/anahtar, biçim, kayıt + nedenli çıkış, sunucu reddi, e-posta doğrulama ön koşulu, emülatör açıklaması, zorunlu modda kaldırma yok).
    - `e2e/auth.spec.ts` (4×2): sahte adım yok; yanlış şifre Türkçe; sıfırlama e-postası emülatöre düşüyor ve kayıtsız adreste nötr mesaj; hesap güvenliği sayfası menüden açılıyor.
    - e2e `loginAs` artık hedef sayfanın yüklenmesini bekliyor (`expectSuccess`). Önceden sahte TOTP adımı bu beklemeyi dolaylı sağlıyordu; kaldırılınca 5 test yarış nedeniyle düştü, düzeltildi.
  - Doğrulandı: lint, format, typecheck, no-mock, unit 177, e2e 38 (+2 ekran boyutuna özel atlanan), next build. Giriş hatası ve hesap güvenliği sayfası ekran görüntüsüyle kontrol edildi.

#### F3.5 Kayıt, KVKK ve durum ekranları (M)
- **Dosyalar:** `src/app/(auth)/register/page.tsx`, `src/app/(auth)/pending/page.tsx`, `src/app/(auth)/verify-email/page.tsx`, `src/app/(public)/kvkk/page.tsx`
- **Yapılacaklar:**
  - Kayıt: şifre tekrarı, güç ipucu, davet kodu, **KVKK aydınlatma metni linki ve zorunlu onay kutusu** (`consentVersion`).
  - Sıra: `createUser` → `sendEmailVerification` → `completeRegistration`.
  - Bekleme ekranı: sade metin (jargon yok), "Çıkış yap" butonu, onay gelince otomatik yönlendirme (F2.4 dinleyicisi).
  - Askı ekranı ayrıdır: farklı metin, çıkış butonu.
  - E-posta doğrulama ekranında "tekrar gönder" butonu.
  - Kayıt formundaki ünvan listesi: kıdem yılı yalnızca "Asistan Dr." için sorulur.
- **Doğrulama:** e2e `registration.spec.ts`: kayıt → bekleme → admin onayı (ikinci context) → bekleyen kullanıcı yenilemeden aktif olur; davet kodlu kayıt doğrudan aktif olur.
- **✅ Uygulanan (sapmalar ve eklemeler):**
  - **KVKK aydınlatma metni** `functions/src/shared/consent.ts` (sürüm `1.0`, yürürlük tarihi, bölümler).
    - İçerik uygulamanın gerçekten işlediği verilerden türetildi: kimlik/iletişim, kıdem, hesap güvenliği, yoklama/sınav/okuma kayıtları, cihaz bağlama özeti, denetim kayıtları; amaçlar, hukuki sebep, aktarım (Google Cloud/Firebase, europe-west1, yurt dışı işleme), saklama, md. 11 hakları.
    - **Veri sorumlusu kimliği kodda değil**, `NEXT_PUBLIC_KVKK_CONTROLLER_NAME` / `NEXT_PUBLIC_KVKK_CONTACT` (`src/lib/kvkk.ts`). Yapılandırılmamışsa `/kvkk` bunu açıkça söyler ve kayıt formu başvuru almaz (aydınlatma yükümlülüğü yerine getirilemez). `.env.development` yalnızca emülatör değerleri içerir.
    - `/kvkk` (route group `(public)`), kayıt formundan yeni sekmede bağlantı.
    - **Hukuki onay gerekli:** metin bir hukuk görüşü değildir. Kurumun KVKK sorumlusu yayından önce onaylamalı (F10.2'ye eklendi). Açık rıza ve yurt dışı aktarım dayanağı (standart sözleşme / açık rıza) kurumun kararıdır; şu an "aydınlatma metnini okudum" onayı alınıyor, açık rıza alınmıyor.
  - **Sunucu:** `completeRegistration` `consentVersion`'ı **zorunlu** ve **yalnızca güncel sürüm** (`z.literal`) olarak kabul eder; profile `consent: { version, acceptedAt }` yazılır.
  - **Kıdem yılı yalnızca asistan için** (`RESIDENT_TITLE`, `isResidentTitle`):
    - Şemada asistan için zorunlu (`superRefine`); diğer ünvanlarda sunucu `null` yazar.
    - `residencyYear` modelde `number | null` (üye, claim, davet, yoklama kaydı, sınav girişimi).
    - **Sessiz uydurma kaldırıldı:** functions'ta 6 yerde eksik kıdem `?? 1` ile "1. yıl" olarak yazılıyordu (claim, yetki değişikliği, yoklama, sınav). Artık `null`.
    - Seed'deki "Prof. Dr." eğitim sorumlusunun kıdem yılı 4 → `null`.
    - Kenar çubuğunda "Uzman hekim" etiketi (`memberRoleLabel`).
    - Davette kıdem yılı isteğe bağlı.
  - **Yolda bulunan hata:** ilk sürümde şema `transform` ile uzman için `residencyYear: null` üretiyordu. İstemci şemanın ÇIKTISINI gönderdiği için sunucu bu `null`'ı reddedecekti. Dönüşüm kaldırıldı. Birim testi: gönderilen istek sunucu şemasından yeniden geçer.
  - **Kayıt formu yeniden yazıldı** (`Field`/`Button`/`Alert`):
    - Ünvan, kıdem yılı (yalnızca asistan), ad soyad (`autoComplete=name`), e-posta (`email`), şifre + tekrar (`new-password`, ipucu), davet kodu (ipucu), KVKK onay kutusu (`aria-invalid`/`aria-describedby`).
    - İstemci ön kontrolleri (`src/lib/auth/password.ts`); asıl şifre politikası Identity Platform'da.
    - Hata varsa sunucuya gidilmez, hesap açılmaz.
  - **Plandan sapma, sıra:** `createUser` → `completeRegistration` → `sendEmailVerification`. Plan doğrulama e-postasını kayıttan önce gönderiyordu; geçersiz davet kodunda tekrar denemede ikinci e-posta giderdi. E-posta gönderilemezse başvuru yine tamam; bekleme ekranından yeniden gönderilir.
  - **Bekleme ekranı korumalı alanda** (`SessionGuard → PendingNotice`):
    - "Başvurunuz onay bekliyor", ad/e-posta, sade metin.
    - E-posta doğrulanmamışsa `EmailVerification` paneli (gönder + "Doğruladım"; hesap güvenliği sayfasıyla ortak bileşen, `src/components/auth/`).
    - "Çıkış yap" düğmesi.
    - Onay gelince sayfa kendiliğinden açılır (F2.4 canlı dinleyici).
    - Kayıt sonrası `/dashboard`'a gidilir; **`/pending` artık sunucu yönlendirmesi** (eski bağlantılar için). Teknik "Custom Claims" metni silindi.
  - **Askı ekranı:** askıdaki üye oturum bağlamında hemen çıkarılır ve giriş ekranında `?neden=askida` mesajını görür (F2.4). `SessionGuard` ara durumda içerik göstermez. Ayrı sayfa gerekmedi.
  - Testler:
    - functions +2 (onay zorunlu, eski sürüm reddi, profil yazılmıyor; uzman `null` + claim, asistan yılsız reddi; mevcut kayıt testine onay saklama kontrolü).
    - unit +3 (çıktı yeniden doğrulanır; `memberRoleLabel`; `passwordProblem`).
    - e2e kayıt: davetsiz kayıt → doğrulama e-postası emülatöre düşer, bekleme ekranı doğrulama ve çıkış sunar; KVKK onayı / şifre tekrarı yoksa hata, hesap açılmaz, e-posta gitmez; `/kvkk` sürüm ve veri sorumlusu; uzman başvurusunda kıdem alanı yok ve profilde `null`. Oturum ve smoke testleri yeni başlıkla güncellendi.
    - e2e yardımcı: `fillRegistration(page, email, { inviteCode, fullName, title, consent })`; "Şifre" seçicisi `/^Şifre(\s*\*)?$/` (Playwright etiket eşleşmesine zorunlu alan yıldızı dahil oluyor).
  - Doğrulandı: lint, format, typecheck, no-mock, unit 180, rules 48, functions 47, e2e 46 (+2 ekran boyutuna özel atlanan), next build.
  - **Ortam notu:** zaman aşımıyla kesilen bir e2e koşusu `next start -p 3100` sürecini açık bırakıyor; sonraki koşu (`reuseExistingServer`) silinmiş `.next` ile eski sunucuyu kullanıp her testi düşürüyor. Böyle bir durumda önce `pkill -f next-server`. Kural + e2e paketi tek komutta 10 dakikayı aşabiliyor; ayrı çalıştırın.

---

### F4 — Yoklama modülü

#### F4.1 Backend sağlamlaştırma (M)
- **Dosyalar:** `functions/src/attendanceService.ts`, `functions/src/scheduled.ts`, `functions/test/attendance.test.ts`
- **Yapılacaklar:**
  - `startLectureSession`: `attendance_meta/live` kilit dokümanı ile transaction. `expectedAttendees` (o andaki aktif asistanların uid listesi) oturuma yazılır. `durationMinutes` limiti ortak sabitten gelir.
  - `endLectureSession`: varlık ve durum kontrolü. Kilit bırakılır, sır silinir.
  - `getProjectorCode`: `endsAt` kontrolü.
  - `verifyRealTimeAttendance`:
    - Transaction kullanılır.
    - Mevcut kayıt okunur. Durum geçişlerinde sayaç deltaları uygulanır (yok→present +1; excused→present: present +1, excused −1).
    - İlk cihaz bağlama transaction içinde yapılır.
    - Denetim kaydı aynı transaction içinde yazılır.
    - `method` değeri yalnızca sunucuda doğrulanmış yöntemi yansıtır.
  - `markAttendanceExcused`: aynı delta mantığı; tekrar çağrıda sayaç artmaz.
  - `closeExpiredLectures` (`onSchedule('every 5 minutes')`): süresi dolan oturumları kapatır, sırları siler, kilidi bırakır. Mantık export edilen saf bir fonksiyonda tutulur ve doğrudan test edilir (emülatör zamanlayıcıyı tetiklemez).
- **Testler:** eşzamanlı 2 yoklama → sayaç 1; excused↔present deltaları; süresi dolmuş oturum; ikinci canlı oturum reddi; kapanmış oturuma kod isteği.
- **✅ Uygulanan (sapmalar ve eklemeler):**
  - **Bütün yoklama yazımları transaction içinde**; denetim kaydı aynı transaction'da (`auditIn(tx)`). Reddedilen girişimlerin (cihaz uyuşmazlığı, geçersiz kod, aynı cihazdan ikinci hesap) denetim kaydı transaction **dışında** yazılır: transaction bir sonuç türü döndürür (`VerifyOutcome`), kayıt ve hata ondan sonra. Aksi halde hata fırlatıldığında kayıt da geri alınırdı.
  - `verifyRealTimeAttendance`:
    - Oturum, sır, kullanıcı, mevcut kayıt ve aynı cihaz sorgusu tek transaction'da okunur.
    - Cihaz bağı guard'dan gelen profilden değil transaction'daki güncel dokümandan kontrol edilir; ilk bağlama da aynı transaction'da.
    - Geçişler: yok → katıldı (+1); mazeretli → katıldı (katılan +1, mazeretli −1, denetimde `previousStatus`); katıldı → değişiklik yok.
  - `markAttendanceExcused`:
    - Yok → mazeretli (+1); mazeretli → yalnızca not (sayaç değişmez, `ATTENDANCE_EXCUSE_UPDATED`).
    - **Plandan sapma:** katılmış hekim mazeretliye **çevrilmez** (`failed-precondition`). Doğrulanmış katılımın yanlış tıklamayla silinmesini önler.
    - Kapanmış derse mazeret işlenebilir; olmayan ders veya hekim `not-found`.
  - **Tek canlı ders kilidi** `attendance_meta/live` (`{sessionId, endsAt}`), transaction'da. Kilit süresi dolmuş bir derse aitse yeni başlatma o dersi aynı işlemde `expired` olarak kapatır (zamanlayıcı beklenmez).
  - `startLectureSession` derse `expectedAttendees` (o andaki etkin `role=user` üyeler, admin ve bekleyen hariç) ve `expectedCount` yazar: F4.5 raporlarında katılım oranının paydası.
  - `endLectureSession`: yoksa `not-found`, zaten kapalıysa `failed-precondition`; `closeReason: "manual"`, kilit bırakılır, sır silinir.
  - `getProjectorCode`: `endsAt` geçmişse kod üretmez ("Ders süresi doldu").
  - **`closeExpiredLectures(now)`** (`attendanceService.ts`, dışa aktarılan fonksiyon; her ders kendi transaction'ında, eşzamanlı manuel kapatmada çift kayıt olmaz): `closedBy: "system"`, `closeReason: "expired"`, sır ve kilit silinir, `ATTENDANCE_SESSION_EXPIRED`. Zamanlayıcı `functions/src/scheduled.ts → closeExpiredLecturesJob` (`every 5 minutes`, `europe-west1`, `Europe/Istanbul`).
  - Bileşik indeks: `attendance_sessions (status, endsAt)` (`firestore.indexes.json`).
  - Tipler: `AttendanceSessionDoc` + `expectedAttendees`, `expectedCount`, `closeReason`; `AttendanceLiveLockDoc`; `COLLECTIONS.attendanceMeta`.
  - **Kapsam dışı (F9.2'ye):** denetim kaydına tuzlu `ipHash` ve geçersiz kod denemeleri için hız sınırı. Sınavların `closesAt` ile otomatik kapanması F5.1'de aynı zamanlayıcı dosyasına eklenecek.
  - Testler:
    - functions +11: eşzamanlı aynı hekim (sayaç 1, biri "zaten kayıtlı", tek denetim kaydı); eşzamanlı iki hekim (2); eşzamanlı iki başlatma (yalnızca biri); beklenen katılımcılar; mazeretli → katıldı; tekrar mazeret ve katılmışa mazeret reddi; kapanmış derse mazeret ve `not-found`; bitirme hataları ve kilidin bırakılması; süresi dolmuş derste kod/yoklama yok; `closeExpiredLectures` (kapatır, dokunmaz, tekrar boş); süresi dolmuş kilidin yeni başlatmada temizlenmesi.
    - Mutasyon: "zaten katıldı" kontrolü ve kilit kaldırılınca 4 test düşüyor.
    - rules +1: `attendance_meta` ve `attendance_secrets` admin dahil kapalı.
    - Unit: callable sözleşme testi zamanlanmış işi callable saymıyor.
  - Functions emülatörü `closeExpiredLecturesJob`'u yüklüyor ve Pub/Sub emülatörü olmadığı için tetiklemiyor (beklenen; mantık doğrudan test edildi).
  - Doğrulandı: lint, format, typecheck, no-mock, unit 180, rules 49, functions 58, e2e 46 (+2 ekran boyutuna özel atlanan), next build.

#### F4.2 WebAuthn cihaz bağlama (L)
- **Dosyalar:** `functions/src/webauthn.ts`, `functions/src/shared/schemas.ts`, `src/lib/webauthn.ts`, `src/app/(protected)/account/device/page.tsx`
- **Callable'lar:**
  - `beginDeviceRegistration` / `finishDeviceRegistration`: credential `users/{uid}.webauthn = {credentialId, publicKey, counter, createdAt}` olarak saklanır.
  - `beginAttendanceAssertion(sessionId)`: tek kullanımlık challenge, `webauthn_challenges/{id}` içinde, TTL 2 dk.
  - `verifyRealTimeAttendance`, `{sessionId, code, assertion}` alır ve assertion sunucuda doğrulanır.
- **İstemci:**
  - İlk yoklamada cihaz kayıtlı değilse kayıt akışı başlar.
  - Admin "cihaz sıfırla" işlemi `webauthn` alanını siler.
  - "Aynı cihazdan çoklu hesap" kontrolü artık gereksizdir: passkey hesaba özeldir. Kod kaldırılır.
- **RP ID:** `NEXT_PUBLIC_WEBAUTHN_RP_ID` (emülatörde `localhost`, prod'da hosting domaini).
- `localStorage` sırrı, `webAuthnVerified` checkbox'ı ve "cihaz simülasyonu" seçimi **silinir**.
- **Testler:** functions testi (geçersiz imza, tekrar kullanılan challenge, sayaç geri gitmesi) ve Playwright CDP `WebAuthn.addVirtualAuthenticator` ile e2e.
- **✅ Uygulanan (sapmalar ve eklemeler):**
  - Bağımlılıklar: `@simplewebauthn/server` **14.0.3** (functions; 14.1.0 o gün 4 günlüktü, kural gereği bir önceki), `@simplewebauthn/browser` **14.0.0**. Üretim `npm audit` değişmedi (D15 zinciri).
  - **Sunucu `functions/src/webauthn.ts`:**
    - `beginDeviceRegistration` / `finishDeviceRegistration` / `beginAttendanceAssertion` (hepsi "member").
    - Kayıt: `platform` doğrulayıcı, **`userVerification: "required"`**, `attestation: "none"`, ES256 + RS256; hesap başına tek cihaz.
    - Credential `users/{uid}.webauthn = {credentialId, publicKey (COSE, base64url), counter, transports, backedUp, createdAt}`.
    - Challenge'lar `webauthn_challenges/{uid}_{register|attendance}`: 2 dk, **tek kullanımlık** (transaction'da okunup silinir), yoklama challenge'ı **derse bağlı**.
    - Denetim: `ATTENDANCE_DEVICE_REGISTERED`, `…_REGISTRATION_REJECTED`, `…_ASSERTION_REJECTED` (CRITICAL), `…_CHALLENGE_EXPIRED_OR_REUSED`.
  - **`verifyRealTimeAttendance` sözleşmesi `{sessionId, code, assertion}`.** İmza aynı transaction'da doğrulanır: credential kimliği eşleşmesi, köken, RP, UV, imza, sayaç. Doğrulayıcı sayacı güncellenir; yöntem **`qr+webauthn`**.
    - `deviceId`, `hashDeviceId`, `boundDeviceHash`, "aynı cihazdan ikinci hesap" sorgusu ve `qr+device_bound` türü **kaldırıldı**.
    - Admin "cihaz sıfırla" `webauthn` alanını siler (oturum iptali F2.3'teki gibi).
  - **Plandan sapma, RP ID tek kaynak sunucuda:** `WEBAUTHN_RP_ID` ve `WEBAUTHN_ORIGINS` functions parametreleri (`config.ts`; emülatör `.env.demo-pediatrist`: `localhost`, `http://localhost:3100,http://localhost:3000`). İstemci RP bilmez, seçenekleri sunucu üretir; `NEXT_PUBLIC_WEBAUTHN_RP_ID` kaldırıldı. Parametre yoksa cihaz işlemleri `failed-precondition` ile reddedilir.
  - **Bulunan kural:** Firestore transaction'da bütün okumalar yazmalardan önce olmalı. Challenge'ı "oku + sil" yardımcısı bu yüzden diğer okumalardan sonra çağrılır (yorumda belirtildi).
  - **İstemci:**
    - `src/lib/webauthn.ts`: `passkeySupport`, `registerAttendanceDevice`, `checkInWithPasskey`.
    - `src/lib/errors.ts`: tarayıcı WebAuthn hataları (kütüphane `ERROR_*` kodları ve DOMException adları) Türkçe; adı benzeyen sıradan hatalar etkilenmez.
    - `/account/device` sayfası (destek kontrolü, adımlar, kayıt, durum çipi, eşitlenmiş passkey notu); kenar çubuğunda "Yoklama cihazı" bağlantısı (`DEVICE_PAGE`).
    - Oturumda `hasBoundDevice` artık `webauthn` alanından.
  - **Sahte verili yoklama sayfası (F4.4'te yeniden yazılacak):**
    - Sahte "cihaz simülasyonu" seçimi ve "biyometrik onay" kutusu silindi.
    - Yoklama artık `checkInWithPasskey` ile **beklenen ve hatası gösterilen gerçek çağrı** (`invokeWithFallback` bu işlemde kalktı).
    - Cihaz kayıtlı değilse yönlendirme var.
    - "Kamera ile tara" sahte düğmesi F4.4'te (QR deep-link) kaldırılacak.
  - `getOrCreateClientDeviceSecret` (localStorage) silindi. Seed'de `boundDeviceHash` kaldırıldı, kapanmış seed dersinin kayıtları `qr+webauthn`.
  - Testler:
    - **Yazılım doğrulayıcı** `functions/test/softAuthenticator.ts` (yalnızca test): P-256, gerçek ES256 imzalar, `none` attestation, küçük bir CBOR kodlayıcı. İmza bozma, UV'siz, yanlış köken ve sayaç geri alma seçenekleri var.
    - functions +14 (toplam 72):
      - kayıt seçenekleri, kayıt ve saklama, tek cihaz, tek kullanımlık challenge (geçersiz deneme tüketir), UV'siz kayıt, süresi dolmuş challenge, RP ayarı yoksa red, bekleyen üye;
      - yoklamada cihazsız üye, bozuk imza, UV'siz imza, oltalama kökeni, başka hekimin telefonu, tekrar oynatma, sayaç geri alma, başka dersin challenge'ı, admin sıfırlama ve yeni kayıt, aynı imzayla eşzamanlı iki istek (biri geçer, sayaç 1).
    - **Mutasyon:** UV şartı kapatılınca ve challenge silinmeyince 6 test düşüyor.
    - rules +1 (`webauthn_challenges` sahibine dahil kapalı); unit: sözleşme (imzasız/yanlış tür/aşırı uzun imza reddi), WebAuthn hata eşlemesi.
    - **e2e `device.spec.ts`** (Chromium CDP sanal doğrulayıcı, iki ekran boyutu): kayıt sunucuda doğrulanır ve doğrulayıcıda credential oluşur → admin sıfırlar → oturum kapanır, alan silinir → yeniden giriş ve yeniden kayıt; UV verilmezse Türkçe hata ve kayıt yok. Yardımcılar: `deleteField`, `hasField` (seed hesabını başlangıç durumuna getirir).
  - Doğrulandı: lint, format, typecheck, no-mock, unit 181, rules 50, functions 72, e2e 50 (+2 ekran boyutuna özel atlanan), next build.
  - **Kapsam notu:** arayüzden uçtan uca yoklama (kod + passkey) e2e'si F4.4'te (hekim ekranı gerçek veriye geçince). İmza doğrulaması functions testlerinde gerçek kriptografiyle sınanıyor.

#### F4.3 Admin ve projektör (M)
- **Dosyalar:**
  - `src/app/(protected)/attendance/page.tsx`: rol yönlendirmesi; mock'lar silinir.
  - `src/components/attendance/AdminAttendance/*`: eski `AdminLiveAttendanceProjector.tsx` parçalanır.
  - `src/app/(protected)/attendance/projector/[sessionId]/page.tsx`: kiosk.
- **Yapılacaklar:**
  - Canlı oturum `onSnapshot(attendance_sessions where status=='live')` ile dinlenir.
  - Başlat/Bitir işlemleri `useAsyncAction` ve `ConfirmDialog` ile yapılır.
  - Varsayılan eğitici adı oturumdaki admin profilinden gelir.
  - **Kiosk:**
    - `getProjectorCode`, `msUntilRotation` anında yeniden çağrılır.
    - Kod büyük monospace (~15vw) gösterilir.
    - QR, `qrcode` paketiyle üretilir ve `${origin}/attendance?s=<id>&c=<code>` adresini kodlar.
    - Geri sayım halkası, Fullscreen API ve Screen Wake Lock kullanılır.
    - `useIdleExempt()` ile kilit muafiyeti alınır.
  - Canlı katılımcı listesi `attendance_sessions/{id}/records` dinlenerek gösterilir. Liste `expectedAttendees` + `users` ile birleştirilir.
  - Mazeret girişi `markAttendanceExcused` ile yapılır.
- **Doğrulama:** e2e (F4.6).
- **✅ Uygulanan (sapmalar ve eklemeler):**
  - **Veri katmanı** `src/lib/attendance/live.ts`: canlı okumalar (`onSnapshot`) için kancalar: `useLiveLecture`, `useLecture`, `useLectureRecords`, `useMyRecord`, `useRecentLectures`, `useActiveDoctors`; dönüştürücüler `toLecture`, `toRecord`. `isLectureOpen`: süresi dolmuş ama henüz kapatılmamış ders açık sayılmaz. Bileşik indeks `attendance_sessions (status, startedAt desc)`.
  - **Admin** (`src/components/attendance/admin/AdminAttendance.tsx`; plandaki parçalı klasör yerine tek dosyada alt bileşenler):
    - Ders başlatma formu (`Field`, sınırlar `LIMITS.lectureMinutes`, kategori `LECTURE_CATEGORIES`, eğitici varsayılanı oturumdaki admin).
    - Canlı ders kartı: katılan/beklenen, mazeretli, `Countdown`, süre doldu uyarısı, "Projektör ekranını aç" (yeni sekme), "Dersi bitir" (`ConfirmDialog`).
    - **Canlı katılım listesi** `buildRoster`: ders başındaki `expectedAttendees` + sonradan katılanlar, etkin hekimler (`users`), kayıtlar canlı. Sıra: bekleyen, mazeretli, katılan. Kıdem ve yoklama cihazı durumu da gösteriliyor.
    - Mazeret penceresi (`Dialog` + not alanı, `markAttendanceExcused`).
    - Son 10 kapanan ders (kapanış nedeniyle). Ayrıntılı raporlar F4.5.
    - Başarı bildirimi yalnızca sunucu yanıtından sonra (`Toast`).
  - **Projektör** `/attendance/projector/[sessionId]` + `ProjectorKiosk`:
    - Kod `getProjectorCode` ile sunucudan, **sunucunun bildirdiği `msUntilRotation` anında** yenileniyor; geçici hatada 5 sn sonra tekrar; ders bitince duruyor.
    - Büyük monospace kod (`clamp(3rem, 11vw, 11rem)`), yenilenme geri sayımı ve boşalan çubuk.
    - QR (`qrcode`, yerel üretim): `${origin}/attendance?s=<ders>&c=<kod>`.
    - Fullscreen API, Screen Wake Lock (destek yoksa uyarı), `useIdleExempt`, canlı katılan sayısı.
    - Yalnızca admin (hekim için açık uyarı; kod üretimi sunucuda zaten admin'e özel).
  - **Plandan sapma: hekim yoklama çekirdeği F4.4'ten öne alındı** (`DoctorCheckIn.tsx`). Uçtan uca gerçek yoklama ancak böyle test edilebiliyordu.
    - Canlı ders dinleniyor; kod + passkey ile katılım; "katıldınız" bilgisi kendi kaydı dinlenerek gösteriliyor (iyimser başarı yok).
    - QR bağlantısındaki kod, ders eşleşirse önceden dolduruluyor.
    - Cihaz kayıtlı değilse yönlendirme var; mazeretliyse bilgi veriliyor.
    - F4.4'e kalanlar: kişisel katılım geçmişi (`attendance_logs`), metin/cilalama.
  - **Silinenler:** `AdminLiveAttendanceProjector.tsx` (794 satır mock: sahte kadro, sahte oturumlar, istemcide `Math.random` kod) ve `DoctorRealTimeCheckIn.tsx` ("kamera ile tara" düğmesi beklenen kodu doğrudan kopyalıyordu). `attendance/page.tsx` artık yalnızca rol yönlendirmesi. **Sahte veri izin listesi 9 → 6 dosya.**
  - **E2E ile bulunan mobil düzen hatası:** `DataTable`'ın ekran okuyucuya özel başlık hücresi (`.sr-only`, mutlak konumlu) kaydırma kabını aşıp **sayfayı telefonda 486 px'e genişletiyordu**; diyaloglar kayıyor, düğmeler "sabit" olmuyordu. Çözüm: `.table-wrap { position: relative }` (bütün tablolar). E2E'ye `expectNoHorizontalOverflow` eklendi (yoklama ve gezinme testleri).
  - `.env.development`: boşluklu KVKK değeri tırnaklandı (kabukta `source` edilebilir).
  - Testler:
    - unit +4: `buildRoster` sıralama/birleştirme, ayrılmış üyenin kayıttaki adı, `checkInUrl`, `isLectureOpen`.
    - **e2e `attendance.spec.ts`** (iki ekran boyutu, üç sekme):
      - hekim sanal doğrulayıcıyla cihazını kaydeder → admin dersi başlatır → hekim ekranı yenilenmeden dersi görür;
      - projektör sunucu kodunu ve QR'ı gösterir → hekim QR bağlantısıyla gelir (kod dolu) ve passkey onayıyla katılır → "Yoklamanız alındı";
      - admin sayacı, listesi ve projektör sayacı canlı güncellenir; yatay taşma yok;
      - mazeret penceresi → dersi bitir (onay penceresi, odak "Vazgeç"te) → son derslerde "Eğitici kapattı" → projektörde "Yoklama kapandı" → hekimde açık ders yok.
      - Ayrıca: hekim projektör ekranını açamaz.
    - Yardımcılar `e2e/fixtures/webauthn.ts` (`withVirtualAuthenticator`, `registerDeviceViaUi`), `closeLiveLectures` (yarım kalmış koşudan kalan canlı dersi temizler).
  - **Ekran görüntüsüyle bulunan ve düzeltilen görsel hatalar:**
    - Projektör kodu harf arasına konan boşluklarla iki satıra bölünüyor, sonra kırpılıyordu. Boşluklar kaldırıldı, harf aralığı CSS'te, `white-space: nowrap`, boyut `clamp(2.5rem, 6vw, 7.5rem)`. E2E kodun sütuna sığdığını ölçüyor.
    - Tabloda satır başlığı hücresi diğer hücrelerden farklı dikey hizadaydı ve son satırda fazladan alt çizgi vardı (`vertical-align: middle`, son satır kuralı).
  - Doğrulandı: lint, format, typecheck, no-mock, unit 186, rules 54, functions 73, e2e 56 (+2 ekran boyutuna özel atlanan), next build; ek olarak yoklama, gezinme ve CSP testleri son CSS değişikliğinden sonra yeniden koşturuldu.

#### F4.4 Hekim yoklama ekranı (M)
- **Dosyalar:** `src/components/attendance/DoctorCheckIn/*`
- **Yapılacaklar:**
  - Canlı oturum dinlenir. `?s=&c=` parametreleri varsa kod alanı otomatik dolar.
  - Kod alanı: `autoCapitalize="characters"`, `autoComplete="one-time-code"`.
  - Gönderimde WebAuthn assertion alınır, ardından `verifyRealTimeAttendance` çağrılır. Sunucu sonucu ya da hatası gösterilir.
  - Mobilde yoklama kartı en üstte yer alır.
  - Kişisel geçmiş: `attendance_logs where uid==me orderBy sessionStartedAt desc` (indeks mevcut).
  - Sahte "kamera ile tara" butonu silinir. Gerçek tarama telefonun kendi kamera uygulamasıyla QR üzerinden deep-link'tir.
- **✅ Uygulanan (sapmalar ve eklemeler):**
  - Çekirdek (canlı ders, kod + passkey ile katılım, QR bağlantısıyla dolu kod, sahte "kamera ile tara" düğmesinin kaldırılması) **F4.3'te** yapıldı.
  - **D22 (kullanıcı kararı A):**
    - `functions/src/attendanceService.ts → closeLecture()` kapanışın üç yolunda da çalışıyor. Önce kayıtlar ve eksik hekimlerin profilleri okunuyor, sonra yazılıyor (transaction kuralı).
    - Eksik hekimlere `absent` kaydı ve log yazılıyor, derse `absentCount`, denetimde `absentCount`.
    - `markAttendanceExcused`: katılmadı → mazeretli geçişi (`absentCount` −1, denetimde `previousStatus`).
    - Tipler: `AttendanceStatus` + `absent`, `AttendanceMethod` + `system_absent`, kayıt `verifiedAt: T | null`, `markedAt`.
  - **Kişisel geçmiş** `AttendanceHistory.tsx` + `useMyAttendanceHistory` (`attendance_logs where uid == me orderBy sessionStartedAt desc`, son 100; mevcut indeks):
    - Özet: katılım oranı, katıldım, mazeretli, katılmadım (`summarizeHistory`; mazeretliler paydaya girmez).
    - Tablo: tarih, ders, eğitici, durum (saatli "Katıldım" / not ile "Mazeretli" / "Katılmadım"), boş durum.
  - Admin "Son dersler" tablosuna "Katılmadı" sütunu.
  - Seed: kapanmış seed dersine `expectedAttendees`, `expectedCount`, `absentCount` ve asistan-4 için `absent` kaydı/logu (sunucunun yapacağı gibi).
  - Testler:
    - functions +4: bitirmede absent (katılan/mazeretli dokunulmaz, sayaçlar); süre dolumunda absent; kapanış sonrası mazeret geçişi ve denetim; ders sonrası üye olan beklenmez.
    - unit +2: `toRecord`, `summarizeHistory`.
    - e2e: yoklama akışının sonunda hekimin geçmişinde "Katıldım" ve son derslerde sayılar; asistan-4'ün geçmişinde seed dersi "Katılmadım" ve katılım oranı.

#### F4.5 Raporlar (M)
- **Dosyalar:** `src/components/attendance/reports/*`
- **Yapılacaklar:**
  - Ders bazlı rapor: `attendance_sessions` (sayfalı) + seçilen dersin `records` alt koleksiyonu. Oran paydası `expectedAttendees.length`.
  - Katılımcı bazlı rapor: `attendance_logs where uid==X` + o kullanıcının beklenen oturum sayısı.
  - <%70 uyarısı gerçek veriyle hesaplanır.
  - CSV, `downloadCsv` (`;`) ile alınır.
- **✅ Uygulanan (sapmalar ve eklemeler):**
  - **Sekmeler** (`Tabs` primitifi): Canlı ders | Ders raporu | Hekim karnesi. İki rapor aynı tarih aralığını paylaşır (varsayılan son 90 gün, iki gün de dahil, yerel saat; ters veya geçersiz aralık alan hatası verir, sorgu yapılmaz).
  - **Saf rapor mantığı** `src/lib/attendance/reports.ts`: `rangeBounds`, `buildLectureReport`, `buildDoctorReport`, CSV üreticileri, `slugify`. Okumalar tek seferlik (`getDocs`), "Yenile" ile yeniden okunur. Eski isteğin geç gelen sonucu yenisinin üzerine yazılmaz.
  - **Ders raporu** (`reports/LectureReport.tsx`):
    - Aralıktaki kapanmış dersler (`status == closed`, `startedAt` aralığı, mevcut `status+startedAt desc` indeksi). Sapma: sayfalama yerine tarih aralığı ve 200 ders sınırı; sınır aşılırsa açık uyarı verilir.
    - Seçilen dersin `records` alt koleksiyonu canlı dinlenir. Özet: beklenen, katıldı, mazeretli, katılmadı, oran (+ eşik altı çipi ve uyarısı).
    - Tablo: hekim, kıdem, durum, katılım saati, mazeret notu.
    - **Sonradan mazeret** (kapanmış derste katılmadı → mazeretli, D22): `ExcuseDialog` ayrı dosyaya taşındı, canlı listeyle ortak. Düzenlemede mevcut not dolu açılır; not, canlı güncellemelerde silinmez.
  - **Oran paydası (sapma):** planda `expectedAttendees.length` yazıyordu. Bunun yerine D22 ve kişisel geçmişle aynı tanım kullanılıyor: katıldı / (katıldı + katılmadı). Mazeretliler paydaya girmez; "Beklenen" ayrıca gösterilir.
  - **Hekim karnesi** (`reports/DoctorReport.tsx`):
    - Kaynak `attendance_logs where sessionStartedAt` aralığı (tek alanlı indeks, 5000 log sınırı, aşılırsa uyarı), hekim başına toplanır.
    - Sapma: hekim başına ayrı sorgu yerine tek aralık sorgusu. D22 ile beklenen ders sayısı = o hekimin loglarının sayısı.
    - Süren ders hariç tutulur: katılmadı kayıtları kapanışta yazılır, dahil edilseydi oran yükselirdi.
    - Etkin olup aralıkta dersi olmayan hekim oransız görünür. Etkin olmayan üyenin geçmişi logdaki adla, "(etkin değil)" işaretiyle kalır.
    - Sıra: eşik altındakiler önce, en düşük oran başta.
    - Özet uyarı: kaç hekimin, kimlerin eşik altında olduğu.
    - Hekim seçilince ders dökümü açılır, odak dökümü taşır.
  - **Eşik** ortak sabit `ATTENDANCE_WARN_RATE = 0.7` (`functions/src/shared/constants.ts`). Tam %70 uyarı vermez. Eşik altı yalnızca renkle değil, "Eşik altında" metniyle de belirtilir.
  - **CSV** (`downloadCsv`: `;`, BOM, formül koruması):
    - Ders raporu: her satırda dersin bilgisi + hekim, kıdem, durum, saat, not, beklenen listede.
    - Hekim karnesi: sayılar, oran (%), eşik altında.
    - Hekim dökümü.
    - Tarihler `YYYY-AA-GG SS:DD`. Dosya adları ASCII (`yoklama-2026-11-09-sabah-olgu-…csv`).
  - `AttendanceRecordView.residencyYear`, `LogItem`/`toLogItem` (kişisel geçmiş de bunu kullanır).
  - **Testler:**
    - unit +11 (`tests/unit/attendance/reports.test.ts`): aralık, eşik sınırı, ders özeti, hekim toplama/sıralama/süren ders hariç/etkin olmayan üye, CSV satırları ve formül koruması, dosya adları.
    - rules +1: admin aralık sorguları geçer, asistan reddedilir.
    - e2e +3 (iki ekran boyutu): seed dersi sayıları (%67 eşik altı) ve CSV içeriği; hekim karnesi (asistan-4 %0, uyarı, döküm, iki CSV); kendi açtığı ve kapattığı derste herkes katılmadı → sonradan mazeret → sayılar canlı → düzenlemede not dolu.

#### F4.6 Yoklama testleri (M)
- **Dosyalar:** `e2e/attendance.spec.ts`
- **Senaryo:**
  - Admin context (1280px) dersi başlatır → projektör açılır → kod okunur.
  - Hekim context (iPhone emülasyonu, sanal doğrulayıcı) deep-link ile yoklama verir → admin listesi canlı güncellenir.
  - Yanlış kod hata mesajı verir. Süresi geçmiş kod reddedilir.
  - Mazeret işaretlenir → rapor oranları doğrulanır → CSV indirilir.
- Allowlist'ten `attendance/*` dosyaları çıkarılır.
- **✅ Uygulanan (sapmalar ve eklemeler):**
  - **Senaryonun ana akışı F4.3–F4.5'te yazılmıştı:**
    - Admin/hekim/projektör bağlamları, iki ekran boyutu (1280 px ve iPhone 13, 390 px), sanal doğrulayıcı, QR bağlantısıyla katılım.
    - Canlı liste, mazeret, raporların sayıları ve CSV indirimi.
  - **F4.6'da eklenen e2e senaryoları** (`e2e/attendance.spec.ts`, ortak `startLectureWithProjector` yardımcısı):
    - Yanlış kod reddedilir, cihaz imzası geçerli olsa bile.
    - **Süresi geçmiş kod**: test projektörün iki kez yenilenmesini bekler (≈30 sn), ilk kod reddedilir. Bu, gerçek saatle, sahte zaman olmadan yapılır.
    - Her iki ret sunucuda denetim kaydıyla doğrulanır: yeni fixture `countAuditLogs`, `ATTENDANCE_EXPIRED_OR_INVALID_CODE` = 2. Sayaç 0 kalır, ardından güncel kodla katılım alınır.
    - Kayıtsız cihaz: uyarı ve "Yoklama cihazını kaydet" bağlantısı görünür, düğme kapalıdır.
    - Başka telefon (kendi doğrulayıcısı var, hesabın anahtarı yok) reddedilir; ardından kayıtlı telefonla katılım alınır.
  - **Bulunan ve düzeltilen UX sorunu:** başka telefondan denemede tarayıcının `NotAllowedError`'u genel "iptal edildi" mesajına düşüyordu; hekim nedenini anlayamıyordu.
    - Yoklamaya özgü mesaj eklendi (`src/lib/webauthn.ts → attendancePasskeyError`, `ATTENDANCE_PASSKEY_MISSING`): kayıtlı anahtar yok ya da onay tamamlanmadı; kayıtlı telefonla dene; telefon değiştiyse cihaz sıfırlaması iste.
    - Tarayıcı bu iki durumu gizlilik gereği ayırt ettirmez.
  - **functions +1:** kod penceresi. Saat (`Date.now`) pencere başına hizalanıp ileri alınır: bir önceki pencerenin kodu kabul edilir, iki önceki reddedilir (kayıt yok, sayaç değişmez). Mutasyonla sınandı: `[slot, slot-1, slot-2]` ve `[slot]` ikisi de testi kırıyor.
  - **unit +1:** yoklama passkey hata eşlemesi.
  - Mock bekçisi: `attendance/*` dosyaları F4.3'te allowlist'ten çıkarılmıştı. Yoklama kodunda `INITIAL_`/`FALLBACK_`/`Math.random`/simülasyon yok (kontrol edildi). Allowlist'te 6 dosya (F5.2, F6.2, F7.1, F7.3, F7.5).

---

### F5 — Sınav modülü

#### F5.1 Backend (L)
- **Dosyalar:** `functions/src/quizService.ts`, `functions/src/scheduled.ts`, `functions/test/quiz.test.ts`
- **Yapılacaklar:**
  - `saveQuizDraft`: ortak doğrulayıcı kullanılır. `revealPolicy` ve `closesAt` doğrulanır (gelecekte bir zaman olmalı). `quiz_media/...` görsellerinin Storage'da var olduğu kontrol edilir.
  - Taslak güncelleme/silme: `updateQuizDraft`, `deleteQuizDraft`.
  - `publishQuiz`: devam eden attempt sayısı döndürülür. İstemci uyarı gösterip `force` ile tekrar çağırır. Önceki sınav kapatma ve arşivleme mevcut mantıkla devam eder.
  - `startQuizAttempt`: `{deadlineMs, questions(public alanlar), savedResponses}` döndürür. Resume'da da aynı veri gelir. Görseller için Storage **yolu** döner, istemci `getDownloadURL` ile çözer.
  - `saveAttemptDraft`: debounce'lu yanıt kaydı (`quiz_attempt_drafts`). Süre bitmişse reddedilir.
  - `submitQuizAttempt`:
    - Transaction + `status=='in_progress'` ön koşulu kullanılır.
    - Puanlama sunucuda yapılır.
    - Attempt dokümanına **yalnızca** `score`, `correctCount`, `totalQuestions`, soru başına `isCorrect` ve `userResponse` yazılır.
    - `revealPolicy==='immediate'` ise yanıt tam karneyi de döndürür; değilse döndürmez.
  - `getAttemptReport(attemptId)`: sahibi veya admin çağırır. `immediate` ya da sınav `closed` ise doğru cevaplar ve feedback döner.
  - `closeExpiredQuizzes` zamanlayıcısı `closesAt` geçen sınavları kapatır.
  - Kapatılan sınavın devam eden attempt'leri: deadline'a kadar teslim edebilir (sorular attempt'ten geldiği için erişim sürer).
- **Seed (F0.4'ten devredildi):** `scripts/seed-emulator.ts`'e sınav bölümü eklenir. Admin istemci SDK'sıyla giriş yapılır → `quiz-ornek.csv` ayrıştırılır → `saveQuizDraft` → `publishQuiz` → asistan 1–3 `startQuizAttempt` + `submitQuizAttempt` (farklı doğruluklarla) → `closeQuiz`; ayrıca bir taslak sınav. Böylece analitik ekranları gerçek sunucu puanlamasıyla dolar.
- **Testler:** soruları attempt başlatmadan alamama (kural testi); deadline + 30 sn tolerans; çift teslim; `after_close` politikasında cevap anahtarının sızmaması; resume'da kaydedilmiş yanıtlar; zamanlayıcı mantığı.
- **✅ Uygulanan:**
  - **Sözleşmeler** (`shared/schemas.ts`, `types.ts`, `constants.ts`):
    - `REVEAL_POLICIES` / `DEFAULT_REVEAL_POLICY` (D7).
    - Yeni callable'lar: `updateQuizDraft`, `deleteQuizDraft`, `saveAttemptDraft`, `getAttemptReport`.
    - `publishQuiz` yanıtı ayrımlı birleşim: `{published: true, archivedPreviousCount}` | `{published: false, inProgressCount, currentQuizTitle}`.
    - `startQuizAttempt` → `{attemptId, quizTitle, deadlineMs, resumed, revealPolicy, questions (1–7. alanlar, görsel Storage yolu), savedResponses}`.
    - Karne satırı (`GradedItem`) `options` içerir; `correctAnswers`/`feedbackText` karne kapalıyken `null`.
    - Girişim dokümanı: `results` (soru başına `isCorrect` + `userResponse`), `revealPolicy`, `questionCount`, `autoSubmitted`. `gradedReport` artık yazılmıyor.
  - **Puanlama** ayrı ve yalnızca sunucuda: `functions/src/quizGrading.ts` (cevap anahtarıyla çalıştığı için `shared/` dışında).
    - Yanıt temizleme: metin `maxLength`'e kırpılır; seçenekte boş ve tekrar atılır.
    - Tek seçimde birden fazla yanıt yanlış sayılır; çoklu seçimde küme eşitliği.
  - **`quizService.ts` yeniden yazıldı.** Bütün durum değişiklikleri transaction'da, okumalar yazmalardan önce:
    - Taslak CRUD: görselin Storage'da varlığı CSV satır numarasıyla denetlenir. Güncellemede soru seti `q_001..` üzerine yazılır, fazlası silinir. Yayınlanmış/kapanmış sınav güncellenemez/silinemez.
    - Yayın: devam eden girişim varsa ve `force` yoksa yayın yapılmaz, sayı döner. Taslağın kapanış zamanı geçtiyse reddedilir. Önceki sınav `closeReason: "replaced"`.
    - Kapanış (`closeQuiz`, yeni yayın, zamanlayıcı): arşiv + `revealAt`.
    - Girişim:
      - Kapatılmış sınavda süresi süren girişim devam edip teslim edebilir.
      - `saveAttemptDraft` süre + tolerans sonrası reddedilir.
      - Teslim `in_progress` ön koşullu transaction'dır (çift teslim yok); taslak yanıt silinir.
    - `getAttemptReport`: sahibi veya admin. Başkasının girişimi "bulunamadı" (varlık sızmaz). Admin her zaman tam karneyi görür.
  - **Plana ek iki karar** (D7'nin uygulaması; D-kaydı değişmedi):
    1. **`revealAt` (sızıntı önlemi):** `after_close`'da karne, sınav kapandığında değil, kapanış anı ile kapanışta devam eden girişimlerin en geç bitişi + 30 sn'den büyük olan anda açılır. Erken kapatılan sınavda bitiren hekim, süresi süren meslektaşına cevapları iletemez.
    2. **Süre aşımında adil puanlama:** süre + 30 sn geçtikten sonra gelen teslimde, sıfır puan yerine süre içinde kaydedilmiş yanıtlar puanlanır (`lateSubmission: true`). Teslim edilmeyen girişimi zamanlayıcı kaydedilmiş yanıtlarla teslim eder (`autoSubmitted: true`, `QUIZ_ATTEMPT_AUTO_SUBMITTED`); tarayıcısı kapanan hekim puansız kalmaz.
  - **Zamanlayıcı** `closeExpiredQuizzesJob` (5 dk): `closeExpiredQuizzes` + `finalizeExpiredAttempts`. İndeksler: `quizzes (status, closesAt)`, `quiz_attempts (status, deadline)`.
  - **Kurallar:** `quiz_attempt_drafts` istemciye tamamen kapalı. `quiz_attempts` yorumu güncellendi (girişimde cevap anahtarı yok).
  - **Saat:** `quizClock.now()`. `Date.now`'u genel olarak taklit etmek Firestore SDK'sının zamanlayıcılarını kilitliyordu; testler yalnızca sınav saatini ileri alır.
  - `test:functions` artık Storage emülatörünü de başlatıyor (görsel varlık kontrolü).
  - **İstemci:** yeni callable'lar bağlandı. Eski (mock karışık, F5.2/F5.3'te değişecek) sınav sayfası yalnızca derlensin diye yeni yanıta uyarlandı; karne kapalıyken "Sınav kapandığında görünür" yazar.
  - **Testler:**
    - functions +14 net (`quiz.test.ts` 14, `quizGrading.test.ts` 4; eski 4 test yeniden yazıldı). Kapsam: soruların yalnızca girişimle ve anahtarsız gelmesi; devam ve kaydedilmiş yanıtlar; puan ve girişimde anahtar olmaması; immediate; eşzamanlı çift teslim; tolerans içi/dışı teslim; zamanlayıcının otomatik teslimi; revealAt sızıntı senaryosu; karne erişimi; force'lu yayın; kapanış zamanı ve zamanlayıcı; geçmiş kapanışla yayın; taslak güncelleme/silme; eksik görsel.
    - rules +1: `quiz_attempt_drafts` kapalı.
    - Mutasyonla sınandı: revealAt'ın devam edenleri yok sayması, ön koşulun kaldırılması, geç teslimde gönderilen yanıtın puanlanması ve karnenin hep açık olması testleri kırıyor.
  - **Seed** (`scripts/seed-emulator.ts → seedQuizzes`, F0.4'ten devredildi): veri istemcinin yapacağı gibi üretilir, Firestore'a doğrudan sınav/girişim yazılmaz.
    - Admin ve asistanlar istemci SDK'sıyla Auth emülatörüne giriş yapar; gerçek callable'lar Functions emülatöründe çağrılır. Yanıtlar `CALLABLES` sözleşmeleriyle doğrulanır.
    - Akış: `quiz-ornek.csv` → `saveQuizDraft` → `publishQuiz` → asistan 1/2/3 `startQuizAttempt` + `submitQuizAttempt` (puan 100/67/33, sunucuda) → `closeQuiz`. Ayrıca 1 taslak.
    - Functions emülatörü yoksa seed açık hatayla durur (sessizce atlamaz).
  - **Seed'in yakaladığı hata:** `closeExpiredQuizzesJob` `index.ts`'ten dışa aktarılmamıştı; üretimde zamanlayıcı hiç oluşmayacaktı. Düzeltildi.
    - Kalıcı bekçi: mevcut `tests/unit/schemas.test.ts` testi zamanlanmış işleri artık elle listelemiyor; `scheduled.ts`'ten okuyor. Her `onSchedule` işinin `index.ts`'ten dışa aktarıldığını da denetliyor.
    - Düzeltme olmadan kırıldığı doğrulandı.

#### F5.2 Admin sınav stüdyosu (L)
- **Dosyalar:** `src/components/quizzes/admin/*` (eski `AdminQuizStudio.tsx` parçalanır), `src/app/(protected)/quizzes/page.tsx`
- **Yapılacaklar:**
  - Sınav listesi `quizzes orderBy createdAt` ile gelir; taslak, yayında ve kapalı sekmeleri vardır.
  - CSV yükleme → ortak doğrulayıcı → önizleme (görseller gerçek URL ile) → `saveQuizDraft`.
  - Taslaktan yayın: süre, kapanış ve `revealPolicy` seçilir. `ConfirmDialog` "Mevcut sınav kapanacak, X kişi devam ediyor" der.
  - `quiz_media` toplu görsel yükleme (`uploadBytesResumable`, ilerleme çubuğu).
  - Arşiv `quiz_question_archive` sorgusundan (sayfalı) gelir. CSV dışa aktarım vardır.
  - Banner'lar yalnızca sunucu onayından sonra gösterilir.
  - Önizlemede "Cevap anahtarını göster" varsayılan olarak **kapalı**dır.
- **✅ Uygulanan (sapmalar ve eklemeler):**
  - **Sayfa:** admin `/quizzes` → `QuizAdmin` (gerçek veri). Sekmeler: Sınavlar | Yeni sınav | Görseller | Arşiv.
    - Eski `AdminQuizStudio.tsx` ve `AdminCentralAnalytics.tsx` silindi; uydurma `sampleGraded`/mock loglar gitti. Admin analitiği F5.4'te gerçek veriyle gelecek.
    - **Sapma:** hekim akışı sayfa dosyasında geçici olarak eski haliyle duruyor (`LegacyDoctorQuizzes`, F5.3/F5.4). Bu yüzden `quizzes/page.tsx` izin listesinde kaldı; etiketi F5.2 → F5.4. Liste büyümedi: hâlâ 6 dosya.
  - **Sınavlar** (`QuizList`): `quizzes orderBy createdAt desc` canlı dinlenir.
    - Duruma göre süzme (sayılarla). Yayındaki sınav ayrı kartta (katılım, yayın, kapanış).
    - Taslak: Yayınla / Düzenle / Sil. Yayında: Kapat.
    - Silme ve kapatma `ConfirmDialog` ile, odak "Vazgeç"te.
    - Toast yalnızca sunucu yanıtından sonra. Kapatma toast'ı devam eden hekim sayısını ve `revealAt` saatini söyler.
  - **Yayın diyaloğu:** süre, kapanış (`datetime-local`, yerel saat; gelecekte olmalı) ve sonuç gösterimi seçilir. Sonuç gösterimi radyo grubudur, her seçeneğin sonucu açıklanır.
    - Sunucu `{published:false, inProgressCount}` dönerse diyalog uyarı gösterir ("N hekim hâlâ sınavda… süreleri dolana kadar teslim edebilir") ve "Yine de yayınla" ile `force: true` çağırır.
  - **Taslak düzenleme:** başlık ve ayarlar; isteğe bağlı olarak yeni CSV ile soru setinin tamamı değiştirilir (`updateQuizDraft`).
  - **Yeni sınav** (`QuizImport` + `CsvQuestionsPanel` + `useCsvQuestions`):
    - Ortak `parseNineFieldQuizCsv`. Hatalar satır/alan/mesaj tablosunda gösterilir.
    - Storage'da olmayan görseller `listQuizMedia` ile satır numarasıyla, kaydetmeden önce engellenir; sunucu da denetler.
    - Önizlemede görseller gerçek `<img>` (`getDownloadURL`).
    - "Cevap anahtarını göster" varsayılan kapalı. Doğru seçenek renge ek olarak "Doğru" metniyle işaretlenir.
    - Önizleme 20'şer soruyla genişletilir. Şablon indirilebilir.
  - **Görseller** (`QuizMediaManager`): `uploadBytesResumable` ile çoklu yükleme, dosya başına `<progress>`.
    - Tür ve boyut `QUIZ_MEDIA_UPLOAD` ile denetlenir (Storage kuralıyla aynı).
    - Dosya adından güvenli yol üretilir (`quizMediaPath`, CSV yol kuralına uyar).
    - **Aynı adlı görselin üzerine yazılmaz:** yayındaki sınavın görseli sessizce değişmesin.
    - Yüklü görseller küçük önizleme ve "Yolu kopyala" ile listelenir.
  - **Arşiv** (`QuizArchive`): `quiz_question_archive orderBy archivedAt desc`, 50'şer sayfa, yüklenen sayfalarda arama.
    - CSV dışa aktarımı **içe aktarma biçiminde**: 9 sütun + kaynak sınav + tarih (`toNineFieldCsvRows`). Dosya düzenlenip "Yeni sınav"dan aynen yüklenebilir; gidiş-dönüş birim testi var.
  - **Ortaklaştırılanlar:** `useFirestoreSnapshot` (`src/hooks`, yoklamadan taşındı), `slugify` (`src/lib/slug.ts`), `QuestionPreview` / `QuizImage` (F5.3 sınav ekranı ve karne de kullanacak).
  - **Hata eşlemesi:** Storage kodları (`storage/unauthorized` → "dosya türü/boyutu kabul edilmiyor" vb.) ve öneksiz Firestore kodları artık Türkçe; önceden "beklenmeyen hata"ya düşüyorlardı.
  - **Testler:**
    - unit +9: ayarlar, `datetime-local` gidiş-dönüş, görsel yolu ve dosya denetimi, doküman eşlemeleri, arşiv CSV gidiş-dönüşü, Storage/Firestore hata eşlemesi.
    - e2e +3 (`e2e/quiz-admin.spec.ts`, iki ekran boyutu):
      - Seed listesi ve süzme.
      - Görsel yükleme; aynı ad ve SVG reddi.
      - CSV satır hatası ve eksik görsel engeli; önizlemede gerçek görsel; anahtarın varsayılan kapalı olması.
      - Taslak → düzenle → yayınla. Sınavda hekim varken yeni yayın sunucu onayı ister → "Yine de yayınla" → kapat → arşiv CSV içeriği.
      - Taslak silme (onaylı, sunucuda silindiği doğrulanır).
    - Yeni e2e fixture: `findDocIds`.

#### F5.3 Sınav ekranı (M)
- **Dosyalar:** `src/components/quizzes/exam/*` (eski `ClinicalExamRunner.tsx`)
- **Yapılacaklar:**
  - Sorular ve deadline `startQuizAttempt`'ten gelir. Geri sayım `Countdown` bileşeniyle `deadlineMs` üzerinden yapılır; bileşen tek başına render olur.
  - Yanıtlar `saveAttemptDraft` ile kaydedilir (≈3 sn debounce). Yeniden yüklemede kaldığı yerden devam edilir.
  - Görseller gerçek `<img>` olarak, alt metin ve büyütme özelliğiyle gösterilir.
  - 5 dk ve 1 dk uyarıları `aria-live` ile duyurulur.
  - Süre bitince otomatik teslim olur; `submitting` kilidi çift teslimi engeller.
  - "Sınavdan ayrıl" onay ister ve sürenin devam ettiğini açıkça söyler.
  - Erişilebilirlik: `<fieldset><legend>`, gezgin butonlarında `aria-label="Soru 3, yanıtlandı"`.
  - `useIdleExempt()` ile kilit muafiyeti alınır.
  - Sekme değişimi sayımı "bilgi amaçlı" olarak etiketlenir.
- **✅ Uygulanan (sapmalar ve eklemeler):**
  - **Sınav ekranı** (`exam/QuizExam.tsx`, `exam/ExamQuestion.tsx`):
    - Sorular, `deadlineMs` ve kaydedilmiş yanıtlar `startQuizAttempt`'ten gelir.
    - **Saat farkı:** sözleşmeye `serverNowMs` eklendi. İstemci, isteğin ortasına göre farkı hesaplar ve `Countdown clockOffsetMs`'e verir; cihaz saati yanlışsa geri sayım ve otomatik teslim kaymaz.
    - Uyarılar 5 dk ve 1 dk kala (`aria-live`). Süre bitince otomatik teslim.
    - **Tek teslim kilidi:** onay diyaloğu ve süre bitimi aynı anda teslim edemez (sunucu da reddeder).
  - **Yanıt kaydı:** son değişiklikten 3 sn sonra ve soru değiştirirken (`createSaveQueue`):
    - Aynı anda tek istek; arada gelenlerden yalnızca en sonuncusu gönderilir.
    - Döngü çıkışı ile durum temizliği aynı eşzamanlı adımda: değer kaybolmaz. Başarısız değer bekletilip yeniden denenir. Birim testli.
    - Durum satırı (`aria-live`): "Değişiklikler birazdan kaydedilecek…" / "Kaydediliyor…" / "Yanıtlar kaydedildi (saat)" / hata.
    - **e2e'nin yakaladığı hata:** kayıt sürerken yazılan yanıt, o kayıt bitince "kaydedildi" diye gösteriliyordu. Düzeltildi: yeni değişiklik varsa durum "birazdan kaydedilecek" kalır.
    - Kaydedilmemiş değişiklik varken sayfadan çıkışta tarayıcı uyarısı. `useIdleExempt()`.
  - **Erişilebilirlik:**
    - Seçenekler `<fieldset><legend>`; tek seçim radyo, çoklu seçim onay kutusu.
    - Açık uçlu: `maxLength` + karakter sayacı.
    - Gezgin: `aria-label="Soru 3, yanıtlandı"`, `aria-current="step"`; yanıtlanmış soru renge ek olarak alt çizgili.
    - Soru değişince odak soru başlığına. Dokunma hedefleri ≥ 44 px.
  - **Görseller:** gerçek `<img>` (alt "Soru N görseli") ve "Görseli büyüt" diyaloğu. CSV'de alt metin sütunu yok; soru numarasıyla adlandırılıyor.
  - **"Sınavdan ayrıl":** onay metni sürenin DURMADIĞINI ve bitiş saatini söyler; yanıtlar kaydedilip panele dönülür.
  - **Sekme değişimi** sayılır ve teslimde gönderilir (bilgi amaçlı, puanı etkilemez; denetimde WARN).
  - **F5.4'ten öne alınanlar** (eski hekim akışını tamamen kaldırabilmek için):
    - Hekim sınav kartı (`doctor/DoctorQuizzes.tsx`): yayında sınav yok / başlanmadı / devam ediyor / teslim edildi.
      - Devam eden girişime sayfa açılınca kendiliğinden dönülür (yenileme). Bilerek ayrıldıysa dönülmez.
      - Kapatılmış sınavda süresi süren girişim de devam ettirilebilir.
      - **Tam e2e koşusunun yakaladığı durum:** hekimin aynı anda iki devam eden girişimi olabilir (A'dayken admin B'yi zorla yayınladı, hekim B'ye de girdi). Kendiliğinden dönüş artık yayındaki sınavın girişimini tercih ediyor; karar yayındaki sınav yüklendikten sonra veriliyor (`resumableAttempt(..., preferQuizId)`, birim testli). Ayrıca F5.2 e2e'sinin hazırlık girişimi giriş yapamayan bekleyen üyeye taşındı.
    - Girişimler `quiz_attempts where uid == me` ile okunur. Olmayan dokümanı tek tek okumak kuralda reddediliyor; sorgu kurala uyar.
    - Teslim karnesi (`report/AttemptReport.tsx`):
      - Puan ve soru başına Doğru/Yanlış (metinle).
      - Karne kapalıysa "Doğru cevaplar … itibarıyla açılacak" (`revealAtMs`). Açıksa doğru cevap ve öğrenme noktası.
      - Geç ve otomatik teslim notları.
    - "Sınav sonuçlarım" tablosu: geçmiş girişimler ve `getAttemptReport` ile karne.
  - **Mock temizliği:**
    - Eski `ClinicalExamRunner`, `DoctorGrowthDashboard`, `InstantFeedbackReport` ve sayfadaki `INITIAL_ACTIVE_QUESTIONS` / `FALLBACK_USER_SESSION` / mock girişimler silindi.
    - `quiz-parser`'daki kullanılmayan eski tipler ve `downloadQuizLogsAsCsv` da silindi.
    - **`quizzes/page.tsx` izin listesinden çıktı** (planda F5.5'teydi). İzin listesi 5 dosya.
  - **Testler:**
    - unit +6: kayıt sırası (tek istek / son değer, yarışsız ardışık, hata ve yeniden deneme), devam edilebilir girişim, yanıtlandı, eşleme.
    - functions: `serverNowMs` doğrulaması.
    - e2e +2 (`e2e/quiz-exam.spec.ts`, iki ekran boyutu; ortak `e2e/fixtures/quiz.ts`, `publishForce`):
      - after_close: başla → yanıtla → "birazdan kaydedilecek"→"kaydedildi" → görsel büyüt → yenile → yanıtlar geri gelir → eksik soru onayı → teslim → %67, doğru cevap ve öğrenme notu YOK → admin kapatır → sonuçlarımdan karne → öğrenme notu ve doğru cevap görünür.
      - immediate: başla → ayrıl (süre durmaz uyarısı) → panelden devam (yanıt korunmuş) → hepsini doğru yanıtla → teslim → 100 ve tam karne.
    - Süre dolumu otomatik teslimi e2e'si F5.5'te. Sunucu tarafı functions testlerinde var.

#### F5.4 Hekim paneli, karne, admin analitiği (M)
- **Dosyalar:** `src/components/quizzes/doctor/*`, `src/components/quizzes/report/*`, `src/components/quizzes/admin/Analytics.tsx`
- **Yapılacaklar:**
  - Hekim kartı duruma göre değişir: *yayında sınav yok / başlanmadı / devam ediyor (kalan süre, devam et) / teslim edildi (karne)*.
  - Geçmiş: `quiz_attempts where uid==me orderBy submittedAt desc`.
  - Karne `getAttemptReport` ile alınır. `after_close` politikasında "Doğru cevaplar sınav kapandığında açılacak" yazar.
  - Gelişim grafiği erişilebilir bir tablo yedeğiyle birlikte gösterilir.
  - Admin analitiği `quiz_attempts` ile **uid'e göre** gruplanır, sayfalı ve filtrelidir. Karne inceleme için `getAttemptReport` kullanılır. Uydurma karne üretimi (`sampleGraded`) **silinir**.
- **✅ Uygulanan (sapmalar ve eklemeler):**
  - Hekim kartı, karne ve geçmiş F5.3'te yapıldı (bkz. F5.3). Uydurma karne üretimi F5.2'de silindi.
  - **Analitik mantığı** `src/lib/quiz/analytics.ts` (saf, birim testli): `toAttemptRow` (yalnızca teslim edilmiş), `summarizeScores` (ortalama/medyan yuvarlanır, son puan en yeni teslim), `questionStats`, `groupByDoctor` (**uid'e göre**: aynı adlı iki hekim karışmaz, adı değişen bölünmez; en düşük ortalama önce), `filterAttempts` (kıdem, uzman, teslim türü), `attemptsCsv`.
    - Okuma: `quizId + submittedAt desc` (mevcut indeks) ve tüm sınavlar için `submittedAt desc` (tek alanlı). 500 sınırı, aşılırsa açık uyarı.
  - **Admin "Sonuçlar" sekmesi** (`QuizResults`):
    - Sınav seçimi (taslak hariç) ve özet: teslim, ortalama, medyan, sınavda (`attemptCount − teslim`).
    - **Soru bazında doğru oranı** "meter list" (ad + çubuk + metin değer; çubuk süs).
    - Kıdem ve teslim türü süzgeçleri; 50'şer sayfa. Satırdan `getAttemptReport` (admin'e tam karne).
    - CSV (`;`, teslim türü, dakika).
  - **Admin "Hekimler" sekmesi** (`DoctorProgress`): bütün sınavlardaki teslimler uid'e göre; satırdan puan gelişimi grafiği, teslim listesi ve karne.
  - **Puan grafiği** (`ScoreTrend`, dataviz yöntemiyle):
    - Biçim: zaman içinde tek seri → çizgi. Tek eksen 0–100. Tek seri olduğu için lejant yok; başlık adlandırır.
    - Renk `--clinical-primary`; doğrulayıcı (`validate_palette.js`, açık yüzey) bütün kontrollerden geçti. Uygulamada koyu tema yok.
    - 2 px çizgi, 8 px işaret + 2 px yüzey halkası, kılcal ızgara, uçta değer etiketi (metin rengi).
    - Fare: kılavuz + ipucu. Klavye: odak + ←/→/Home/End, `aria-live` duyuru. Tablo karşılığı aynı sayfada (sonuç tabloları).
  - **Hekim "Gelişimim" kartı:** sınav sayısı, son puan, ortalama, en yüksek; 2+ teslimde grafik.
  - **Testler:**
    - unit +6 (`analytics.test.ts`).
    - e2e +2 (`e2e/quiz-results.spec.ts`, iki ekran boyutu):
      - Seed sınavında 3/67/67, soru oranları 3/3·1/3·2/3, kıdem süzgeci, CSV içeriği, admin'e tam karne.
      - Hekim ikinci sınavını teslim eder → kendi grafiği ve klavye duyurusu → admin Hekimler sekmesinde uid'e göre gelişim ve karne.

#### F5.5 Sınav testleri (M)
- **Dosyalar:** `e2e/quiz.spec.ts`
- **Senaryo:**
  - Admin CSV ve görsel yükler → önizler → `after_close` ile yayınlar.
  - Hekim sınava başlar → yanıtlar → sayfayı yeniler → yanıtlar korunmuştur → teslim eder → doğru cevapları göremez.
  - Admin sınavı kapatır → hekim tam karneyi görür.
  - `immediate` politikasıyla ikinci bir akış.
  - Süre dolumu otomatik teslimi.
- Allowlist'ten `quizzes/*` çıkarılır.
- **✅ Uygulanan:**
  - Senaryonun bütün adımları e2e'de (`quiz-admin`, `quiz-exam`, `quiz-results`, `quiz-timeout` spec'leri; iki ekran boyutu):
    - CSV + görsel yükleme → önizleme → after_close yayın.
    - Hekim başlar → yanıtlar → yeniler → korunur → teslim → doğru cevapları göremez.
    - Admin kapatır → tam karne; immediate akışı.
    - **Süre dolumu** (`e2e/quiz-timeout.spec.ts`): 1 dk'lık sınav, hekim bir soruyu yanıtlar ve bekler. Ekran kendiliğinden teslim eder (gerçek saat, sunucu toleransı içinde; geç sayılmaz). Karne 33 puan ve tam karne (immediate).
      - ~70 sn sürer; ekran boyutundan bağımsız olduğu için yalnızca masaüstünde koşar (telefonda `test.skip`, gerekçeli).
  - **Testin yakaladığı UX boşluğu:** süre dolup ekran kendiliğinden teslim ettiğinde hekime bu yalnızca bir anlık uyarıyla söyleniyordu; teslim hızlıysa hiç görünmüyordu.
    - Karneye kalıcı "Süre doldu, yanıtlarınız otomatik teslim edildi" notu eklendi: `onSubmitted(result, timedOut)` → `ReportData.timedOut`.
    - Sunucunun otomatik teslimi (`autoSubmitted`) ve geç teslim (`lateSubmission`) notlarından ayrı.
  - Mock bekçisi: `quizzes/*` F5.3'te izin listesinden çıktı. Sınav kodunda `INITIAL_` / `FALLBACK_` / `Math.random` / `sampleGraded` / `invokeWithFallback` yok (kontrol edildi). İzin listesi 5 dosya (F6.2, F7.1, F7.3, F7.5).

---

### F6 — Materyaller modülü

#### F6.1 Backend (M)
- **Dosyalar:** `functions/src/materialsService.ts`, `functions/test/materials.test.ts`
- **Callable'lar:**
  - `createMaterial`: doküman taslağı + Storage yolu `materials/{id}/{filename}`.
  - `finalizeMaterialUpload`: dosyanın varlığı, boyutu ve MIME türü kontrol edilir; ardından `status:'published'`.
  - `updateMaterial`.
  - `deleteMaterial`: Storage dosyası + `progress` alt koleksiyonu silinir.
- Hepsi denetim kaydı yazar. `uploadedBy` sunucuda profilden gelir.
- **✅ Uygulanan:**
  - **Sözleşmeler:**
    - Kategori `MATERIAL_CATEGORIES`, hedef kıdem `RESIDENCY_YEARS` (en az 1, tekrarsız), içerik türü `MATERIAL_UPLOAD` (PDF / video / görsel; pptx ve SVG yok, D19; mesaj "Sunumları PDF olarak yükleyin").
    - Boyut ≤ 150 MB. `LIMITS.descriptionLength`.
  - **`functions/src/materialsService.ts`:**
    - `createMaterial` → `draft` + yükleme yolu `materials/{id}/{ascii-ad}.{içerik türünden uzantı}`. Dosya adındaki uzantıya güvenilmez.
    - `finalizeMaterialUpload`: Storage'da dosya **gerçekten var mı**, metadata'daki tür beyanla aynı ve izinli mi, boyut sınırda mı → `published`. Boyut ve tür Storage'daki gerçek değerlerle yazılır.
    - `updateMaterial`: yalnızca meta veri.
    - `deleteMaterial`: önce Storage öneki, sonra `recursiveDelete` (doküman + bütün `progress`). Denetimde silinen ilerleme sayısı.
    - `uploadedBy` ve `uploadedByName` admin profilinden. Her işlem denetim kaydı yazar.
  - **Kurallar:**
    - Taslak materyal hekime görünmez (`resource.data.status == 'published'`; hekim listesi bu filtreyle sorgular).
    - İlerleme yalnızca yayındaki materyale yazılır (taslak/silinmiş/olmayan → ret).
    - **Storage okuma kuralına materyal durumu eklenmedi (bilinçli):** Storage kuralları istek başına sınırlı Firestore okuması yapabiliyor; `isActive()` zaten profil + güvenlik ayarı okuyor. Taslak dosyasının yolu rastgele kimlik içerir, liste izni de yok.
  - **Seed:** materyaller artık gerçek callable'larla (`createMaterial` → Storage'a yükleme → `finalizeMaterialUpload`). Seed Functions emülatörü olmadan açık hatayla durur.
  - **İstemci:** 4 callable bağlandı (UI F6.2).
  - **Testler:**
    - functions +6 (`materials.test.ts`): akış ve profilden yükleyen; dosyasız/tür uyuşmazlığında yayın reddi; pptx, SVG, boyut, kıdem ve kategori reddi; hekim reddi; güncelleme; silmede Storage + ilerleme + doküman; güvenli ad.
    - rules +1: taslak görünmezliği, ilerleme yazımı, liste sorgusu filtresi.

#### F6.2 Admin yönetimi (M)
- **Dosyalar:** `src/components/materials/admin/*`
- **Yapılacaklar:**
  - Dosya seçici, `uploadBytesResumable` ile ilerleme çubuğu, iptal.
  - Kategori, hedef kıdem, zorunluluk ve indirme izni seçimi; kategori ortak listeden gelir.
  - Düzenle ve sil (onay diyaloğu ile).
  - Okunma raporu: `collectionGroup('progress')` veya materyal bazlı `progress` sorgusu. Hedef kitle = hedef kıdemdeki aktif asistanlar.
- **✅ Uygulanan (sapmalar ve eklemeler):**
  - **Sayfa:** admin `/materials` → `MaterialsAdmin` (sekmeler: Materyaller | Yükle).
    - Eski `AdminMaterialManager.tsx` (dosya seçicisiz "yükleme", sabit "Prof. Dr. Selim Kaya", sahte `.slides`) silindi.
    - **Sapma:** hekim görüntüleyicisi sayfada geçici olarak eski haliyle duruyor (`LegacyDoctorMaterials`, F6.3). `materials/page.tsx` izin listesinde, etiketi F6.3. İzin listesi 5 → 4 dosya.
  - **Yükleme** (`MaterialUploadForm`):
    - Dosya türü ve boyutu `MATERIAL_UPLOAD` ile istemcide denetlenir (pptx için "sunumları PDF olarak" mesajı).
    - Başlık geçerli dosyanın adından önerilir. **e2e'nin yakaladığı hata:** reddedilen dosyanın adı da öneriliyordu.
    - Kategori ortak listeden; hedef kıdemler çoklu onay kutusu (en az bir); zorunlu; indirme izni.
    - Akış `runMaterialUpload` (saf, birim testli): `createMaterial` → `uploadBytesResumable` (ilerleme çubuğu + **iptal**) → `finalizeMaterialUpload`.
      - İptal, yükleme hatası ya da sunucu reddi olursa yarım taslak `deleteMaterial` ile silinir; asıl hata gösterilir.
      - Temizlik de başarısızsa "taslağı elle silin" denir. Liste taslağı "Yükleme tamamlanmadı" diye gösterir; silinebilir.
    - Başarı yalnızca sunucu yayınlayınca gösterilir.
  - **Liste** (`MaterialList`): canlı (taslak dahil), tür, boyut, hedef kıdem, durum, zorunlu.
    - Düzenle (yalnızca meta veri; "dosyayı değiştirmek için silip yeniden yükleyin").
    - Sil (`ConfirmDialog`; toast silinen okuma kaydı sayısını söyler).
  - **Okunma raporu** (`MaterialReadReport`, `buildReadReport` saf):
    - Hedef kitle = hedef kıdemdeki **etkin** asistanlar (`useActiveDoctors`).
    - Hedef dışından okuyan "(hedef dışı)" olarak listelenir ama sayılara katılmaz. Etkin olmayan üye adıyla gösterilir.
    - Özet: hedef / tamamladı / başladı / başlamadı. İlerleme canlı. CSV (`;`, dakika).
    - Kaynak, materyal bazlı `progress` alt koleksiyonu.
  - Hata eşlemesi `storage/canceled` → "Yükleme iptal edildi." (F5.2'de eklenmişti).
  - **Testler:**
    - unit +6 (`tests/unit/materials/admin.test.ts`): akış, iptal/hata/sunucu reddinde taslak temizliği, temizlik hatası, oluşturma hatasında temizlik denenmemesi, dosya denetimi, okunma raporu hedef kitle/sıralama, CSV.
    - e2e +2 (`e2e/materials-admin.spec.ts`, iki ekran boyutu):
      - Seed listesi; okunma raporu ve canlı ilerleme (hazırlık kaydı emülatöre yazılır; hekim görüntüleyicisi F6.3); CSV.
      - pptx reddi; PDF yükle → yayında, hedef kıdem/kategori/tür; düzenle; sil (sunucuda doküman yok).

#### F6.3 Görüntüleyici (L)
- **Dosyalar:** `src/components/materials/viewer/*` (eski `WatermarkedMaterialViewer.tsx`)
- **Yapılacaklar:**
  - **PDF:** `pdfjs-dist` ile canvas'a sayfa sayfa çizim (worker `blob:`), üstte filigran katmanı (ad, e-posta, zaman damgası). Not (F0.4): pdf.js standart fontlar için `standardFontDataUrl` ister. Fontlar `public/` altına kopyalanıp bu parametre verilmeli, aksi halde Helvetica gibi standart fontlu PDF'lerde uyarı ve yanlış render oluşur.
  - **Video:** `<video controls controlsList="nodownload">`.
  - **Görsel:** `<img>`.
  - Hekim listesinde kendi kıdemi varsayılan filtredir.
  - İlerleme: görünür sekmede geçen süre ve son sayfa, `progress/{uid}` dokümanına debounce'lu yazılır.
  - "Tamamlandı" ancak son sayfaya ulaşılınca veya video ≥%90 izlenince aktifleşir.
  - `allowDownload` doğruysa indirme butonu (`getDownloadURL`) gösterilir.
  - Etiket "Filigranlı görüntüleme" olur (D11). Storage yolu UI'da gösterilmez.
- **✅ Uygulanan:**
  - **Liste** (`viewer/DoctorMaterials.tsx`): `materials where status == published` canlı.
    - Varsayılan kıdem süzgeci hekimin kıdemi ("(benim)"); kıdemsiz uzmanda "Bütün kıdemler". Kategori ortak listeden.
    - Kartta kendi durumum: Okunmadı / Okumaya başladınız / Tamamlandı (`progress/{uid}`).
  - **PDF** (`viewer/PdfViewer.tsx`, `pdfjs-dist` 6):
    - Worker ve standart fontlar `public/pdfjs/` altında. `scripts/copy-pdfjs-assets.mjs` kurulu paketten kopyalar (sürüm hep aynı); `postinstall`, `predev`, `prebuild`'de çalışır; git'e girmez.
    - e2e web sunucusu artık `npm run build` ile derler (prebuild çalışsın).
    - `useWasm: false`: CSP `'wasm-unsafe-eval'` içermiyor; JPEG2000 dışında gerekmez. CSP değişikliği gerekmedi (`worker-src 'self'`); e2e CSP bekçisi ihlal görmedi.
    - Sayfa canvas'a çizilir; **filigran (ad, e-posta, zaman) aynı canvas'a yakılır** (ekran görüntüsünde kalır).
    - Seçilebilir metin katmanı yok (kopyalamayı caydırır). **Ekran okuyucu için sayfa metni** görünmez bölgede verilir (erişilebilirlik caydırıcılıktan önce gelir).
    - Sayfa çevirme düğmelerle ve klavyeyle (←/→, PageUp/PageDown, Home/End; odaklanabilir sayfa bölgesi). Sağ tık kapalı (caydırıcı).
    - **Telefon e2e'sinin yakaladığı hata:** genişlik değişince (kaydırma çubuğu) yeni çizim, iptal edilen çizim bitmeden aynı canvas'ta başlıyordu → pdf.js reddediyor, "Sayfa çizilemedi". Çizimler artık zincirle sıralı; iptal edilen çizimin hatası yok sayılıyor.
  - **Video** `<video controls controlsList="nodownload noremoteplayback" disablePictureInPicture>`; **görsel** `<img>`. İkisinde de filigran üst katmanı.
  - **İlerleme** (`MaterialViewer`, `mergeProgress` saf):
    - Yalnızca sekme **görünürken** geçen süre sayılır; 15 sn'de bir, sekme gizlenince ve kapanışta yazılır.
    - Son sayfa = en uzak okunan sayfa (geri gitmez). Tamamlandı geri alınmaz. Kural sınırlarına kırpılır.
    - Yazma hatasında uyarı gösterilir ve süre sonraki denemede yeniden gönderilir.
  - **"Tamamlandı olarak işaretle"** ancak PDF'te son sayfa çizilince, videoda ≥ %90 izlenince, görselde hemen açılır (`canComplete`); ipucu ilerlemeyi gösterir ("1 / 3").
  - **İndirme** yalnızca `allowDownload` ise ("İndir"). Etiket "Filigranlı görüntüleme" (D11). Storage yolu UI'da yok.
  - **Mock temizliği:** eski `WatermarkedMaterialViewer.tsx` (sabit metin "sayfalar", sahte DRM etiketi) ve sayfadaki `INITIAL_MATERIALS` / `FALLBACK_SESSION` / sahte okuyucu istatistikleri silindi. **`materials/*` izin listesinden çıktı** (izin listesi 3 dosya: F7.1, F7.3, F7.5).
  - **Staging:** Storage CORS kuralı F10.2 listesine eklendi.
  - **Testler:**
    - unit +4 (`tests/unit/materials/doctor.test.ts`): ilerleme birleştirme, tamamlanabilirlik, süzgeç, filigran metni.
    - e2e +1 (`e2e/materials-viewer.spec.ts`, iki ekran boyutu, ekran başına ayrı hekim; F6.4 senaryosu):
      - Varsayılan süzgeçte hedef dışı materyal görünmez, "Bütün kıdemler"de görünür.
      - PDF gerçekten çizilir (canvas boyutu, ekran okuyucu metni); indirme yok.
      - "Tamamlandı" düğmesi son sayfaya kadar kapalı; düğme ve klavyeyle sayfa çevrilir; tamamlanır; listede "Tamamlandı".
      - İndirme izinli materyalde "İndir".
      - Admin okunma raporunda hekim "Tamamladı", son sayfa 3.

#### F6.4 Materyal testleri (S)
- **Dosyalar:** `e2e/materials.spec.ts`
- **Senaryo:**
  - Admin PDF yükler → hekim (doğru kıdem) görür, açar, sayfaları gezer → tamamlandı → admin raporu güncellenir.
  - Hedef dışı kıdemdeki hekim varsayılan filtrede materyali görmez.
  - Admin materyali siler → Storage'dan da silinir.
- Allowlist'ten `materials/*` çıkarılır.
- **✅ Uygulanan:** senaryo `e2e/materials-viewer.spec.ts` (F6.3) ve `e2e/materials-admin.spec.ts` (F6.2: yükle/sil, sunucuda doküman yok; Storage silmesi functions testinde). `materials/*` F6.3'te izin listesinden çıktı.

---

### F7 — Admin paneli, dashboard, hesaplayıcılar

#### F7.1 Üye paneli ve davetler (M)
- **Dosyalar:** `src/app/(protected)/admin/page.tsx` (sadeleştirilir), `src/components/admin/members/*`, `src/components/admin/invitations/*`
- **Yapılacaklar:**
  - Canlı `users` listesi; arama ve durum filtresi; bekleyenler üstte.
  - Satır işlemleri bir menüde toplanır. Her biri `ConfirmDialog` (kişi adı ve sonuç açıkça yazılır) + sunucu sonucu toast'ı ile çalışır.
  - "Onayla" ve "Yeniden etkinleştir" ayrı eylemlerdir.
  - Admin yapma işlemi isim yazarak onay ister.
  - Kendi satırında rol ve durum işlemleri devre dışıdır.
  - Seçimler etiketli `Field` bileşeniyle yapılır.
  - **(F3.4'ten) "İki aşamalı doğrulamayı sıfırla"** (telefonunu kaybeden üye): Admin SDK ile faktörleri silen `resetMemberMfa` callable'ı + oturum iptali (`tokensValidAfter`) + denetim kaydı; `ConfirmDialog` ile. MFA zorunluyken üye kendi faktörünü kaldıramaz.
  - Davetler: oluşturma (e-posta, rol, kıdem, son kullanma), listeleme, iptal.

#### F7.2 Denetim kaydı görüntüleyici (S)
- **Dosyalar:** `src/components/admin/audit/*`, `firestore.indexes.json` (gerekirse `severity+timestamp`)
- **Yapılacaklar:**
  - `audit_logs orderBy timestamp desc limit 50` + "daha fazla" (cursor) ile sayfalama.
  - Önem derecesi ve modül filtreleri.
  - İstemcide denetim kaydı üretimi (`recordAudit`) **silinir**.

- **✅ Uygulanan F7.1 + F7.2 (sapmalar ve eklemeler):**
  - **Sunucu:** yeni `resetMemberMfa` callable'ı (`members.ts`, `defineCallable(..., "admin")`).
    - Admin SDK ile bütün faktörleri siler (`multiFactor.enrolledFactors: null`).
    - Aynı batch'te `tokensValidAfter` ve `MEMBER_MFA_RESET` (WARN, `metadata.factorsRemoved`) yazılır; ardından refresh token'lar iptal edilir.
    - Kendi hesabında `failed-precondition`, olmayan kullanıcıda `not-found`.
    - Sözleşme `@shared/schemas` `CALLABLES`'ta. Functions testleri 98 → 100 (+ faktör sayısı, self, yetkisiz, olmayan kullanıcı). Auth emülatörü MFA faktöründe `uid` istiyor.
  - **İndeksler:** `audit_logs (severity, timestamp desc)` ve `(resourceType, severity, timestamp desc)`. Süzgeçler sunucu sorgusudur, istemcide süzme yok.
  - **İstemci veri katmanı:** `src/lib/admin/members.ts`.
    - Üyeler (canlı, 1000 sınırı, bekleyenler üstte), `availableActions` (onayla/yeniden etkinleştir ayrı; kendi satırında rol/durum/MFA yok), davet durumu (kullanıldı > iptal > süresi doldu > geçerli).
    - Denetim sayfası (50'şer, `startAfter` cursor) ve bütün sunucu eylemlerinin Türkçe etiketi.
    - Birim testi, `functions/src`'deki her eylem dizesinin bir etiketi olduğunu denetler (yeni eylem etiketsiz kalamaz). Unit 231 → 235.
  - **Arayüz:** `components/admin/{AdminPanel, members/MemberList, invitations/Invitations, audit/AuditLog}`, sekmeler: Üyeler | Davetler | Denetim kayıtları.
    - Satır başına tek "İşlemler" düğmesi → işlem menüsü (diyalog) → kişiyi ve sonucu söyleyen `ConfirmDialog` → sunucu yanıtından sonra toast. Hata diyalogda kalır.
    - Eğitim sorumlusu yapma: ad yazılmadan (Türkçe küçük harf/boşluk duyarsız) buton kapalı. Kıdem değiştirme: etiketli `select` diyalogu.
    - "Yoklama cihazını sıfırla" yalnızca kayıtlı passkey varsa görünür.
    - Davetler: kod sunucuda üretilir, ekranda gösterilir ve kopyalanır (e-posta gönderimi yok; kod kurum içi kanaldan iletilir). İptal `ConfirmDialog` ile.
    - Denetim: önem + modül süzgeçleri, "Daha fazla yükle", ayrıntı (`metadata`) `<details>` ile.
  - **Mock temizliği:** eski `admin/page.tsx` (uydurma üyeler/kayıtlar, istemcide `recordAudit`, `invokeWithFallback`, satır içi stiller) silindi. **`admin/page.tsx` izin listesinden çıktı** (izin listesi 2 dosya: F7.3, F7.5).
  - **e2e:** yeni `admin-panel.spec.ts` (3 test × 2 proje) ve `fixtures/admin.ts`.
    - `createPendingMember` Auth emülatörü REST + `users` dokümanıyla kendi üyesini kurar; seed hesapları değişmez.
    - Yaşam döngüsü: onay → adı yazarak eğitim sorumlusu → yetki kaldırma → kıdem → askı → yeniden etkinleştirme → MFA sıfırlama. Her adım emülatörden doğrulanır.
    - Kendi satırında işlem yok. Davet: geçersiz e-postada sunucu hatası, oluştur → kod → iptal. Denetim önem süzgeci.
    - `session.spec` ve `device.spec` eski `#admin-…` kimlikleri yerine menüyü kullanıyor. `session.spec`'te cihaz sıfırlama yerine MFA sıfırlama oturumu sonlandırır: kayıtsız cihazda "cihazı sıfırla" artık gösterilmiyor; cihaz sıfırlamayı `device.spec` kayıtlı passkey ile sınar.

#### F7.3 Dashboard (M)
- **Dosyalar:** `src/app/(protected)/dashboard/page.tsx`, `src/components/dashboard/*`
- **Yapılacaklar:**
  - Ana kart duruma göre tek bir birincil eylem gösterir: canlı ders varsa "Yoklamaya katıl", yayında sınav varsa "Sınava başla / devam et", yoksa yaklaşan zorunlu materyal.
  - **KPI'lar** `getCountFromServer` / `getAggregateFromServer(average)` ile hesaplanır:
    - Admin: bekleyen üye sayısı, son 30 gün katılım oranı, aktif sınav katılımı.
    - Hekim: sınav ortalaması, tamamlanan zorunlu materyal, katılım oranı.
  - Her KPI boş durum ve yükleniyor halini destekler. Sabit sayı **yoktur**.

- **✅ Uygulanan F7.3 (sapmalar ve eklemeler):**
  - **Karar mantığı saf ve birim testli** (`src/lib/dashboard`, 8 test):
    - `doctorNextStep`: öncelik sırası açık derse katılım (kaydı yoksa; mazeretli/katıldı sayılır) → süresi işleyen girişim (`resumableAttempt`) → yayındaki, girmediği ve kapanış zamanı geçmemiş sınav → tamamlamadığı zorunlu materyal (en eski yayın önce) → "Bekleyen işiniz yok".
    - `adminNextStep`: süren ders → onay bekleyen başvuru → yayındaki sınav → yok. Yok durumunda ikincil bağlantılar (ders başlat, sınav hazırla, materyal yükle) gösterilir.
    - Ana kart canlı veriden (ders, kayıt, sınav, girişim, materyal) hesaplanır; 30 sn'lik saatle ders bitişi ve sınav süresi yeniden değerlendirilir. Sayfa yenilenmeden güncellenir (e2e: admin başka tarayıcıda ders başlatır / mazeret girer / sınavı kapatır).
  - **Göstergeler sunucu sayımıdır**, sabit sayı yoktur. Yükleniyorken "Hesaplanıyor…", hatada Türkçe hata kutunun içinde, veri yoksa "—" ve açıklama.
    - Hekim: sınav ortalaması (puanlanmış teslimler), zorunlu materyal (kendi `progress/{uid}` dokümanları, kural genişletilmedi), derse katılım (`getCountFromServer`, D22 paydası; %70 altı uyarı).
    - Admin: onay bekleyen başvuru (`getCountFromServer`), son 30 gün katılım (kapanmış derslerin `presentCount`/`absentCount` toplamı, `getAggregateFromServer`; mevcut `status + startedAt` indeksi), yayındaki sınavda teslim / çözen / etkin hekim. "Göstergeleri yenile" düğmesi.
  - **Ek:** ana sayfadaki "Materyali aç" doğrudan görüntüleyiciyi açar (`/materials?materyal=<id>`, `MATERIAL_PARAM`). Listeye dönünce parametre silinir; materyal yayından kalktıysa uyarı gösterilir.
  - **İndeksler:** `attendance_logs (uid, status)` ve `quiz_attempts (quizId, status)` sayım sorguları için eklendi (emülatör indeks denetlemez; üretimde açık olsun).
  - **Mock temizliği:** eski dashboard (sabit "Canlı Ders Açık", "76 / 100", "1 Hekim", modül çipleri, satır içi stiller) silindi. **`dashboard/page.tsx` izin listesinden çıktı**; listede yalnızca `callables.ts` (F7.5) kaldı.
  - **e2e:** `dashboard.spec.ts` (2 test × 2 proje). `fixtures/admin.ts`'te `createMember` (etkin/bekleyen, kıdem) var.
    - Hekim akışı: yeni hekimin boş göstergeleri → yayındaki sınav → canlı ders (yenilemeden) → admin mazereti → zorunlu materyal → doğrudan görüntüleyici.
    - Admin akışı: onay bekleyen sayısı emülatörden okunur, ana kartta ve göstergede aynıdır; onaydan sonra bir azalır.

#### F7.4 Hesaplayıcılar (S)
- **Dosyalar:** `src/app/(protected)/calculators/page.tsx`, `src/lib/pediatrics/index.ts`, `functions/src/calculatorsService.ts` (opsiyonel)
- **Yapılacaklar:**
  - D8 uygulanır: kartlar "Yakında" olarak gösterilir. "Maksimum doz güvenlik kilidi aktif" gibi çalışmayan özellik iddiaları kaldırılır; bunlar "planlanan" olarak etiketlenir.
  - Admin protokol notu `calculators_config/{id}` dokümanına **callable ile** kaydedilir (`updateCalculatorConfig`; F2.1'de kural admin yazımını da kapattı, denetim kaydı için).
  - Katalogdaki statik tanımlar ürün metadata'sıdır (mock değildir) ve kalabilir.

- **✅ Uygulanan F7.4 (sapmalar ve eklemeler):**
  - **Sunucu:** `updateCalculatorConfig` callable'ı (`functions/src/calculatorsService.ts`, `defineCallable(..., "admin")`).
    - `calculators_config/{id}` dokümanına not, yazan (uid + ünvanlı ad) ve zaman yazılır. Boş not dokümanı siler.
    - Aynı batch'te `CALCULATOR_NOTE_UPDATED` / `CALCULATOR_NOTE_CLEARED` denetim kaydı düşer. Kural istemci yazımını kapalı tutmaya devam ediyor.
    - Sözleşme: `CALCULATOR_IDS` (tek kaynak `@shared/constants`; katalogda olmayan kimlik "Hesaplayıcı bulunamadı."), `LIMITS.protocolNoteLength` = 2000, `CalculatorConfigDoc`.
    - Functions testleri 100 → 102 (kaydet/kaldır + denetim kaydı; hekim yetkisiz; bilinmeyen kimlik ve uzun not reddi).
  - **Dürüst katalog** (`src/lib/pediatrics`): ürün yol haritası olarak yeniden yazıldı.
    - Kaldırılanlar: "Kliniğimizde … tercih edilmektedir" gibi uydurma kurum protokolü metinleri, "tavan sınırı aktiftir" / "Maksimum Doz Güvenlik Kilidi" iddiaları, `isActive` / `placeholder_ready` / `v1.0-placeholder`.
    - Kalanlar: başlık, özet, planlanan girdi/çıktılar ve "planlanan güvenlik denetimi (henüz etkin değil)". Katalog `Record<CalculatorId, …>`, kimlik listesiyle kayamaz.
  - **Arayüz** (`components/calculators/Calculators.tsx`): üstte "Hesaplayıcılar yakında" bilgisi (hesaplama yapılmaz; kurum protokollerini kullanın).
    - 5 kart, her biri "Yakında" çipli. Kliniğin protokol notu canlı okunur, yazan ve zamanla gösterilir; yoksa "henüz protokol notu eklemedi".
    - Admin "Not ekle / Notu düzenle" diyaloğu: sunucu yanıtından sonra bildirim; hata diyalogda kalır.
  - **Bulunan ve düzeltilen hata (e2e):** düzenleme diyaloğu başlangıç metnini açıldıktan SONRA bir `useEffect` ile dolduruyordu. Hızlı yazan kullanıcının (testte boşaltılan) metni eski notla eziliyor ve "kaldır" yerine eski not yeniden kaydediliyordu.
    - Aynı desen dört diyalogda vardı: protokol notu, kıdem değiştir (F7.1), mazeret (F4.3), taslak düzenle (F5.2).
    - Hepsi anahtarlı gövde bileşenine çevrildi; başlangıç değeri `useState` başlatıcısında, ilk çizimde hazır. Canlı güncelleme de yazılanı ezmez.
  - **Denetim etiketleri:** iki yeni eylem etiketlendi; birim testindeki önek listesine `CALCULATOR` eklendi.
  - **e2e:** `calculators.spec.ts` (1 test × 2 proje).
    - Hekim 5 "Yakında" kartı görür; "kilidi/aktif" metni yoktur; düzenleme düğmesi yoktur.
    - Admin: uzun not hatası → kaydet (denetim kaydı +1) → hekim yenilemeden görür → boş kaydet = kaldır.

#### F7.5 Fallback temizliği (S)
- **Yapılacaklar:**
  - `invokeWithFallback`, `FALLBACK_*`, `isFirebaseConfigured` ile gizlenen "demo" yolları silinir.
  - Firebase yapılandırılmamışsa uygulama açık bir yapılandırma hata sayfası gösterir.
  - `scripts/no-mock-allowlist.json` **boş** hale gelir ve silinir. Bekçi artık istisnasız çalışır.
- **Doğrulama:** `npm run check:no-mock` ve tüm test paketleri yeşil.

---

- **✅ Uygulanan F7.5 (sapmalar ve eklemeler):**
  - **`invokeWithFallback` silindi** (son çağıranı F7.1'de kalkmıştı). Birim testindeki "deprecated katman" testi de silindi.
    - `src/` ve `functions/src/` içinde `invokeWithFallback`, `FALLBACK_*`, `INITIAL_*`, `syncedWithCloud` yok (bekçi denetliyor).
  - **Sahte veri bekçisi istisnasız:** `scripts/no-mock-allowlist.json` silindi ve `check-no-mock.mjs`'ten izin listesi mantığı çıkarıldı.
    - Her eşleşme hatadır. Dosya geri eklenirse bu da hata sayılır ("istisna eklemek yerine sahte veriyi koddan çıkarın").
    - Elle doğrulandı: geçici ihlal dosyası → çıkış 1; geri getirilen izin listesi → çıkış 1; temiz kod → çıkış 0.
  - **Yapılandırma tek modülde:** `src/lib/firebase/config.ts` (SDK'sız). Zorunlu değişkenler: API anahtarı, authDomain, projectId, storageBucket, appId. Eskiden yalnızca üçü denetleniyordu; eksik Storage/Auth alanıyla uygulama yarım açılabiliyordu.
    - `missingFirebaseConfig()` yalnızca eksik değişken ADLARINI döndürür, değer döndürmez. `client.ts` yapılandırmayı buradan alır.
  - **Yapılandırma hata sayfası** (`components/system/ConfigurationError.tsx`, sunucu bileşeni): kök yerleşim yapılandırma eksikse hiçbir sayfayı açmaz.
    - "Sunucu bağlantısı yapılandırılmamış" başlığı, yönetici için eksik değişken adları, `.env.example` yönlendirmesi. Demo yolu ve bağlantı yok.
    - Değişkensiz `npm run build` (CI'daki derleme adımı) başarılı. Üretilen `/login` ve `/` HTML'i hata sayfasıdır ve yalnızca değişken adlarını içerir.
    - Birim testi: eksik ad listesi, boşluk eksik sayılır, sayfada değer yok, bağlantı/düğme yok.
  - Ekranlardaki dağınık "Sunucu bağlantısı yapılandırılmamış" hataları savunma amaçlı yerinde kaldı (hook'lar ve callable katmanı). Artık kök yerleşim yüzünden pratikte ulaşılamazlar.
  - **e2e ile sınanmadı:** yapılandırmasız derleme ayrı bir `next build` gerektirir ve e2e sunucusu tek derleme kullanır. Kapsama birim testi ve yukarıdaki derleme denetimidir.

### F8 — Erişilebilirlik, metin, performans

#### F8.1 Metin ve erişilebilirlik (M)
- **Yapılacaklar:**
  - Tüm UI metinleri gözden geçirilir: butonlar 1–3 kelime olur, jargon kaldırılır, hata mesajları "ne oldu + ne yapmalı" formatına getirilir.
  - Durum renkleri yalnızca durum için kullanılır; başlık üstü etiketler nötr stildedir.
  - Etiketsiz kontroller etiketlenir. Sekmeler, fieldset'ler ve tablo başlıkları erişilebilir hale getirilir.
  - `e2e/a11y.spec.ts`: her ana sayfada `@axe-core/playwright` çalışır, **0 serious/critical** ihlal hedeflenir.

- **✅ Uygulanan F8.1 (sapmalar ve eklemeler):**
  - **axe testi:** `@axe-core/playwright` 4.14.0 sabit sürümle eklendi.
    - Eş bağımlılık ayrı bir `playwright-core` 1.65 çekiyordu (tip uyuşmazlığı, ikinci kopya). `playwright-core` 1.63.0 kökte sabitlendi, tek kopya kaldı. `@playwright/test` yükseltilirken ikisi birlikte yükseltilmeli; ayrışırsa typecheck kırılır.
    - `e2e/a11y.spec.ts` + `fixtures/a11y.ts`: WCAG 2.1 A/AA, ciddi/kritik ihlal 0, her iki projede.
    - Kapsam: herkese açık sayfalar (giriş, kayıt, şifre sıfırlama, KVKK), hekim sayfaları (7), admin sayfaları ve yönetim paneli sekmeleri, bekleyen hesap ekranı.
    - `expect.soft` kullanılır: bir sayfadaki ihlal diğerlerinin denetimini durdurmaz.
  - **İlk ölçüm:** 8 testin 6'sı temizdi. Bulunanlar:
    - `label-content-name-mismatch` (WCAG 2.5.3): "İşlemler", "İptal et" (Türkçe "İ" küçük harfe "i̇" olarak döner, `aria-label`'daki "işlemler" ile eşleşmez) ve "Not ekle/Notu düzenle" (ad bambaşkaydı).
    - Taramayla aynı desende iki düğme daha bulundu ("CSV indir", "Yolu kopyala").
    - Beşi de görünen metin + görünmez bağlam (`İşlemler<span class="sr-only"> (Dr. X)</span>`) biçimine çevrildi; e2e seçicileri güncellendi.
    - İlk denemede bağlam ": Dr. X" biçimindeydi. Chromium görünmez öğeyi ayrı saydığı için ada boşluk ekledi ("İşlemler : Dr. X") ve tam e2e seçicileri tutmadı. Parantezli biçim (" (Dr. X)") her iki durumda da aynı adı verir.
    - `scrollable-region-focusable` (telefonda /attendance): DataTable kabı yalnızca gerçekten yatay taşıyorsa `tabIndex=0` + `role=region` + başlığıyla `aria-labelledby` alır (`ResizeObserver`; yoksa ilk ölçüm). Taşmayan tabloya gereksiz Tab durağı eklenmez. Birim testli.
  - **Metin:**
    - Jargon taraması temiz. Kalan iki ifade bilinçli: emülatörde görünen "Authenticator kurulumu emülatörde desteklenmiyor" geliştirici bilgisi ve yöneticiye yönelik yapılandırma sayfası.
    - Düğmeler 1–3 kelime; tek istisna "Doğrula ve giriş yap" → "Doğrula".
    - Durum renkleri yalnızca durum için; kategori ve soru türü çipleri nötr (taramayla kontrol edildi).
  - **Hata mesajları "ne oldu + ne yapmalı":** varsayılanlar tamamlandı (yetki, bulunamadı, zaten var, işlem yapılamıyor, yapılandırma, Storage dosya bulunamadı/iptal, passkey https/adres/zaten kayıtlı).
    - "Sunucu bağlantısı yapılandırılmamış" 13 dosyada elle yazılıydı; `notConfiguredError()` / `NOT_CONFIGURED_MESSAGE` ile tek kaynağa alındı.
  - **CI (F7.5 ekinde, ayrı commit):** runner'ın Ubuntu paket aynasına erişememesi e2e'yi iki kez engelledi. Chromium önce başlatılarak denenir, apt yalnızca gerekirse çalışır; Run #45 yeşil.

#### F8.2 Performans ve ölü kod (S)
- **Yapılacaklar:**
  - Saniyelik zamanlayıcılar yalnızca `Countdown` bileşeninde kalır.
  - Büyük listelerde sayfalama yapılır.
  - `src/lib/firebase/admin.ts` ve `firebase-admin`/`server-only` kök bağımlılıkları: kullanılmıyorsa silinir.
  - **Karar notu:** sunucu tarafı rota koruması (session cookie + middleware) bu revizyonda **yapılmaz**. Veri koruması kurallardadır. İleride gerekirse ayrı bir faz olarak eklenir.
  - Nonce tabanlı CSP denenir: kırılma yoksa `'unsafe-inline'` kaldırılır; kırılıyorsa gerekçesi D-kayıtlarına yazılır.
  - `verifyRealTimeAttendance` için `concurrency` ve `minInstances` ayarları belgelenir.

---

- **✅ Uygulanan F8.2 (sapmalar ve eklemeler):**
  - **Zamanlayıcı taraması** (`grep setInterval|setTimeout src`): saniyelik durum güncelleyen tek yer `Countdown`.
    - Materyal görüntüleyicinin saniyelik sayacı yalnızca bir `ref` artırır (yeniden çizim yok). Ana sayfa saati 30 sn. Diğerleri tek seferlik `setTimeout` (projektör kodu dönüşü, yanıt kaydı gecikmesi, boşta kalma, toast).
    - Düzeltilen: video `timeupdate` (saniyede birkaç kez) her olayda görüntüleyiciyi yeniden çiziyordu. İzlenme oranı artık %1'lik adımlarla güncellenir (en fazla 100 güncelleme; %90 eşiği etkilenmez).
  - **Sessiz liste kırpılması giderildi:** `useCapped` (sorgu `limit(sınır + 1)`; fazladan kayıt gösterilmez, yalnızca `truncated` bildirir) ve `ListLimitNotice`.
    - Uygulananlar: üyeler (1000), admin materyalleri (200), sınavlar (100; liste ve sonuç ekranı), hekimin girişimleri (200; "Gelişimim" özeti).
    - Zaten açıkça "Son N" yazanlar aynen kaldı: davetler (200), kişisel katılım geçmişi (100). Raporlar F4.5/F5.4'ten beri kırpılmayı bildiriyor.
    - Tam sayfalama eklenmedi: klinik ölçeğinde sınırlar yıllarca yeter ve arşiv/denetim/raporlar zaten sayfalı. Sınır aşılırsa ekran bunu söyler. Birim testli (sınır altı, tam sınır, sınır + 1, dizi kimliği, yükleniyor/hata).
  - **Ölü kod:**
    - `src/lib/firebase/admin.ts` (hiç çağrılmayan sunucu Admin SDK başlatıcısı) ve `src/lib/firebase/hooks.ts` (kullanılmayan `useLiveQuery`; hatayı "Veriler yüklenemedi" diye yutan eski kanca) silindi.
    - `server-only` kaldırıldı. `firebase-admin` kökte yalnızca seed betiği için gerekli: `devDependencies`'e taşındı (sürüm aynı). `.env.example`'daki sunucu Admin SDK değişkenleri silindi (okuyan kod kalmadı).
    - Kullanılmayan CSS kuralları silindi (72 satır): `.grid-4`, `.nav-section-label`, `.question-nav-*`, `.progress-track/fill`, `.kpi-row`. Tarama: stil dosyalarındaki her sınıf `src/` içinde aranır; `btn-${variant}` gibi dinamik adlar elle doğrulandı.
  - **Karar notu aynen geçerli:** sunucu tarafı rota koruması (oturum çerezi + middleware) bu revizyonda yok; veri koruması kurallarda ve callable'larda.

### F9 — Uyum ve operasyon

#### F9.1 KVKK (M)
- **Yapılacaklar:**
  - `/kvkk` aydınlatma metni. Metin **kurumun hukuk birimi tarafından onaylanmalıdır**; taslak işaretiyle yayınlanır.
  - Rıza sürümü `users/{uid}.consent = {version, acceptedAt}` alanında tutulur.
  - Sürüm değişince yeniden onay istenir.
  - `deleteMember` callable'ı: Auth kullanıcısı silinir, profil anonimleştirilir, attempt/log/progress kayıtlarında ad alanları temizlenir, denetim kaydı yazılır.
  - `exportMemberData` callable'ı: JSON dışa aktarım.

- **✅ Uygulanan F9.1 (sapmalar ve eklemeler):**
  - **Aydınlatma metni içeriği değiştirilmedi** (kullanıcı kararı: içerik kurumun hukuk birimince onaylanır).
    - `KVKK_NOTICE_APPROVED = false` (`@shared/consent`): `/kvkk` sayfası ve onay ekranı "Taslak metin" uyarısı gösterir. Yazılı onaydan sonra `true` yapılır; metin değişirse sürüm artırılır ve değer yeniden `false` olur.
  - **Yeniden onay:** `acceptConsent` callable'ı (etkin üye; yalnızca güncel sürüm; sürüm + zaman + denetim kaydı).
    - `SessionGuard`: `session.consentVersion` güncel sürüm değilse içerik yerine onay ekranı (metin bağlantısı, onay kutusu, "Onayla", "Çıkış yap"). Kayıttan sonra ekran profil dinleyicisiyle kapanır (iyimser başarı yok).
    - Hiç onayı olmayan hesaplar da (ör. konsoldan oluşturulan ilk admin) ilk girişte onaylar.
    - Zorunluluk arayüzdedir; sunucu çağrıları onay sürümüne göre reddedilmez (aydınlatma bir bilgilendirme yükümlülüğüdür, hukuki sebep md. 5/2). İstenirse `guards.ts`'e eklenebilir.
  - **Üye silme:** `deleteMember` (admin; `functions/src/privacyService.ts`).
    - **Plandan sapma:** profil anonimleştirilmez, SİLİNİR (veri minimizasyonu; ayrı bir "silinmiş" üyelik durumu gerekmez). Kayıtlar `uid` ile kalır ama kişiyi tanımlayan alanlar temizlenir.
    - Temizlenenler: sınav girişimlerinde ad → "Silinmiş üye" (`DELETED_MEMBER_NAME`); yoklama logu ve ders kaydında ad/ünvan ve **mazeret notu** (sağlık bilgisi içerebilir); kullanılan davetteki e-posta; admin ise materyal ve protokol notu imzaları.
    - Silinenler: giriş hesabı, profil (cihaz bağı dahil), materyal ilerlemeleri, sınav yanıt taslakları, kullanılmamış davetler, WebAuthn challenge'ları.
    - Kalanlar: puanlar ve yoklama durumları (istatistik), ve denetim kayıtları (güvenlik kaydı; saklama süresi F9.2 TTL ile). Denetim kayıtlarında silinen üyenin e-postası `actorEmail` olarak süre sonuna kadar kalır; bu bilinçli.
    - Sıra yinelenebilir: kayıtlar → giriş hesabı → profil + `MEMBER_DELETED` (CRITICAL, kimlik bilgisi içermez). Yarıda kalırsa profil durduğu için yeniden çalıştırılır (test edildi).
    - Kendi hesabını silemez; çağıran etkin admin olduğundan en az bir admin her zaman kalır.
  - **Bulunan ve kapatılan açık:** silinen üyenin süresi dolmamış oturum belirteciyle `completeRegistration` çağrılabiliyor, adı ve e-postası başvuru listesine geri dönebiliyordu. Callable artık giriş hesabının varlığını denetler (test edildi).
    - İstemci: bu oturumda görülmüş profil kaybolursa kayıt formuna değil `?neden=hesap-silindi` ile giriş ekranına gidilir (`evaluateSession(…, hadProfile)`).
  - **Veri dökümü:** `exportMemberData` (üye kendisi için, admin her üye için; `requireSelfOrAdmin` guards'ta).
    - İçerik: profil, onay, sınav girişimleri ve üyenin kendi yanıtları, yoklama, materyal ilerlemesi, kendi yaptığı denetimli işlemler. Liste başına 2000 sınırı, aşılırsa `truncated`.
    - **Kural 5 korunur:** doğru cevaplar ve açıklama metni dökümde yoktur (test, sınavın bütün açıklama metinlerini dökümde arar).
    - Her döküm denetim kaydına geçer (`MEMBER_DATA_EXPORTED`).
  - **Arayüz:** yönetim panelinde "Veri dökümünü indir" (onaylı) ve adı yazarak "Üyeyi sil" (`PromoteDialog` → genel `TypedNameDialog`). "Hesap güvenliği" sayfasında "Kişisel verilerim" kartı ("Verilerimi indir", onaylanan sürüm).
  - **Testler:** functions 102 → 109 (`privacy.test.ts`: gerçek sınav ve yoklama callable'larıyla kayıt üretip siler/döker). Unit 250 → 255. e2e `privacy.spec.ts` (2 test × 2 proje): onay ekranı (axe dahil) → panel → kendi dökümü; admin dökümü → adı yazarak silme → üyenin açık oturumu kapanır, yeniden giremez, denetim ekranında "Kritik".
    - Seed kullanıcıları ve e2e `createMember` güncel sürümü onaylı yazılır (`consent: false` seçeneğiyle onay ekranı sınanır).
  - **Kapsam dışı (not):** üyenin kendi hesabını kendisinin silmesi yok (admin üzerinden); otomatik saklama süresi sonu silme yok (kurum politikası gerekir).

#### F9.2 Operasyon (S)
- **Yapılacaklar:**
  - `audit_logs` için `expireAt` alanı ve Firestore TTL politikası (süre `DEPLOY.md`'de karar olarak yazılır, örn. 2 yıl).
  - Hız sınırı: uid başına dakikalık sayaç dokümanı (yoklama ve kod denemeleri için). Hassas callable'larda `consumeAppCheckToken: true`.
  - **`ipHash` (F1.3'ten devredildi):** `sha256(salt + rawRequest.ip)`; salt `defineSecret('AUDIT_IP_SALT')`. Emülatör için `functions/.secret.local` gerekir (git'e girmez); seed/README'ye kurulum adımı yazılır veya emülatörde sabit test tuzu kullanılır. S2'deki aynı IP işaretlemesi de bunu kullanır.
  - Log tabanlı alarm (`severity=CRITICAL`), bütçe alarmı ve zamanlanmış Firestore yedeği/PITR, `DEPLOY.md`'de adım adım anlatılır.

- **✅ Uygulanan F9.2 (sapmalar ve eklemeler):**
  - **Saklama süresi:** her denetim kaydı `expireAt = şimdi + AUDIT_RETENTION_DAYS` alır (`auditLogger.ts`, tek yer). Firestore TTL politikası `firestore.indexes.json` `fieldOverrides`'ta (`audit_logs.expireAt`, `rate_limits.expireAt`).
    - Kullanıcı süre belirtmedi: **varsayılan 730 gün (2 yıl)**, `AUDIT_RETENTION_DAYS` parametresiyle ayarlanır. 30 günden kısa ya da geçersiz değer varsayılana döner (yanlış ayar kayıtları erken silmesin).
  - **IP özeti:** `requestContext.ts` (AsyncLocalStorage). `defineCallable` her isteği bağlamda çalıştırır; denetim kaydına `ipHash` (HMAC-SHA256, 32 onaltılık) ve `userAgent` (≤ 200 karakter) eklenir. Ham IP hiçbir yere yazılmaz.
    - Tuz `defineSecret("AUDIT_IP_SALT")`, bütün callable'lara bağlı. Tuz yoksa ya da 16 karakterden kısaysa özet YAZILMAZ (tuzsuz özet geri çevrilebilir).
    - İstemci adresi `X-Forwarded-For`'un SON değeridir (baştaki değerleri istemci uydurabilir).
    - Emülatör: tuz `functions/.secret.local`'dan gelir (gizli değil, dağıtılmaz). Emülatör istemci adresini iletmediği için yerelde `ipHash` boş kalır; başlık elle gönderilerek doğrulandı (yazılıyor).
    - Yönetim paneli › Denetim kayıtları › Ayrıntı: "ağ kimliği" (özetin ilk 8 karakteri; karşılaştırma için).
  - **S2 (iletilen kod):** projektör ekranının ağ özeti gizli dokümanda tutulur (yalnızca değişince yazılır). `ATTENDANCE_VERIFIED` kaydına `sameNetworkAsProjector` eklenir. Katılım engellenmez (mobil verideki dürüst hekim de farklı ağdadır); yalnızca işaretlenir.
  - **Hız sınırı** (`rateLimit.ts`, `rate_limits/{tür}_{uid}`, sabit pencere, transaction): yoklama imza isteği ve kod gönderme 10/dk, kayıt tamamlama 5/dk (davet kodu tahmini), veri dökümü 5/dk.
    - Aşımda `resource-exhausted` ("… N saniye sonra tekrar deneyin") ve pencere başına TEK `RATE_LIMIT_EXCEEDED` kaydı. Sayaçlar istemciye kapalı (kural testi; kendi sayacını sıfırlayamaz).
    - **Yapılmadı:** `consumeAppCheckToken` (replay koruması). İstemcide tek kullanımlık belirteç gerektirir, emülatörde sınanamaz ve her çağrıya gecikme ekler; hız sınırı aynı riski karşılıyor. `DEPLOY.md`'de not edildi.
  - **Alarm:** `CRITICAL` denetim olayları ayrıca Cloud Logging'e işaretli hata satırı olarak yazılır (`jsonPayload.audit="CRITICAL"`, kişisel veri yok); log tabanlı alarm buna kurulur.
  - **`DEPLOY.md` oluşturuldu:** gizli değerler ve parametreler, saklama/TTL, alarmlar (kritik olay, hata oranı, bütçe), yedekleme (PITR, zamanlanmış yedek, Storage, Auth dışa aktarımı, geri yükleme tatbikatı), hız sınırları, "aynı ağ" işareti. Her bölümde staging doğrulama adımı var. Bölüm 1 (dağıtım sırası, ilk admin) F9.3'te yazılacak.
    - **Gerçek projede denenmedi:** TTL politikası, secret bağlama, alarm süzgeci ve `gcloud` komutları staging'de doğrulanmalı (F10.2).
  - **Testler:** functions 109 → 118 (`operations.test.ts` + yoklamada ağ işareti), rules 57 → 58.

#### F9.3 Dokümantasyon (S)
- **Yapılacaklar:**
  - `README.md`: kurulum, emülatör, seed, test komutları, mimari özet.
  - `DEPLOY.md`: deploy sırası (rules → indexes → functions → hosting) ve ilk admin oluşturma (konsolda `users/{uid}` dokümanına `role:'admin', status:'active'` yazılır; `syncUserClaims` claim'leri ayarlar).
  - `Plan.MD`: "Tamamlandı" işaretleri gerçeğe göre düzeltilir ve bu plana link verilir.

---

- **✅ Uygulanan F9.3 (sapmalar ve eklemeler):**
  - **`README.md`** yeniden yazıldı (2 satırdı): modül tablosu (admin / hekim), yerel kurulum (Node 22, Java 21, emülatör, seed, test hesapları), doğrulama komutları, mimari özet, beş temel ilke, bilinen sınırlar. Projenin gerçek bir Firebase projesine henüz dağıtılmadığı açıkça yazıyor.
  - **`DEPLOY.md` bölüm 1** yazıldı: konsol kurulumu (Firestore konumu, Identity Platform, TOTP'nin Admin SDK ile açılması, App Check, API anahtarı kısıtı, Storage → Firestore izni, Storage CORS), ortam değişkenleri, dağıtım sırası ve nedeni, ilk eğitim sorumlusu, dağıtım sonrası kısa kontrol, geri alma.
    - CLI komutları `node scripts/firebase.mjs …` sarmalayıcısıyla verildi (Next barındırması için gereken deneysel özellik).
    - **Doğrulanamadı:** konsol adımları, TOTP'yi açan Admin SDK çağrısı ve `gcloud`/`gsutil` komutları resmî belgeyle karşılaştırılamadı (Firebase bilgi aracı etkin proje istiyor; proje yok). Belgenin başında bu açıkça yazıyor; staging'de doğrulanacak (F10.2).
  - **`Plan.MD`:**
    - Başa durum notu ve "İlk plandan farklılaşan kararlar" tablosu (13 konu, karar kayıtlarına bağlı).
    - Bölüm 1–4 tarihsel metin olarak korundu; yanlış kalan maddelere yerinde "**Güncel:**" notu eklendi (yetki kaynağı, cihaz bağlama, App Check, filigran, denetim kapsamı, hareketsizlik, hesaplayıcılar, sınav soruları ve karne, yönetim paneli).
    - Bölüm 5 (şema), 6 (kurallar), 7 (dizin) güncel koddan yeniden yazıldı. Bölüm 8'deki asılsız "Tamamlandı" işaretleri kaldırıldı; yerine gerçek durum tablosu ve "henüz yapılmayanlar" listesi geldi.
  - **İlerleme tablosu düzeltmesi:** F7.4 satırı iş bittiği halde ⬜ kalmıştı (metin eşleşmediği için güncelleme sessizce atlanmış); ✅ yapıldı. Devir notları doğruydu.

### F10 — Gerçek teste hazırlık

#### F10.1 Tam e2e (M)
- **Kapsam:** Bütün spec'ler CI'da `emulators:exec` içinde yeşil çalışır. 390px ve 1280px projeleri. Flaky testler giderilir (retry ile maskelenmez).

#### F10.2 Staging kontrol listesi (S)
`docs/revision/STAGING_CHECKLIST.md` dosyasına yazılır. Bu adımlar kullanıcının Firebase konsolunda yapacağı işlerdir:
- Yeni proje; Firestore konumu (D10); Blaze planı; bütçe alarmı.
- Identity Platform'a yükseltme; e-posta/şifre; TOTP MFA etkin; şifre politikası (min 10, karışık karakter).
- App Check: reCAPTCHA Enterprise anahtarı; Firestore/Storage/Functions için zorlama.
- Web API anahtarı için HTTP referrer kısıtlaması.
- Storage → Firestore cross-service izni.
- **Storage CORS (F6.3):** pdf.js PDF'i indirme URL'sinden `fetch` ile okur. Bucket'a hosting kökeni için GET CORS kuralı (`gsutil cors set cors.json gs://<bucket>`; `origin: ["https://<hosting-alanı>"]`, `method: ["GET"]`, `maxAgeSeconds: 3600`). Yoksa PDF açılmaz (emülatörde gerekmez).
- Functions parametreleri: `ENFORCE_APP_CHECK=true`, `WEBAUTHN_RP_ID` (hosting alan adı), `WEBAUTHN_ORIGINS` (`https://…`), `AUDIT_IP_SALT` secret.
- MFA ve e-posta doğrulaması (D20, D21): `config/security` dokümanı **oluşturulmaz** (yoksa ikisi de zorunlu) veya `requireMfa: true`, `requireEmailVerified: true` yazılır. `false` yazılmamalı; emülatör dışında `false` görülürse alarm (F9.2).
- WebAuthn RP ID = hosting domaini.
- **KVKK (F3.5):** `NEXT_PUBLIC_KVKK_CONTROLLER_NAME` (kurumun resmi unvanı) ve `NEXT_PUBLIC_KVKK_CONTACT` (başvuru adresi) tanımlanır; boşsa kayıt alınmaz. `functions/src/shared/consent.ts` metni kurumun KVKK sorumlusu/hukuk birimi tarafından onaylanır; yurt dışı aktarım dayanağı (standart sözleşme veya açık rıza) ve saklama süreleri netleştirilir. Metin değişirse `KVKK_NOTICE_VERSION` artırılır.
- Auth e-posta şablonları (doğrulama, şifre sıfırlama) Türkçe ve kurumsal gönderen adıyla ayarlanır.
- Deploy: `DEPLOY.md` sırası; ilk admin kurulumu; smoke test.

#### F10.3 UAT senaryoları (S)
`docs/revision/UAT_SCENARIOS.md`: gerçek hekimler ve eğitim sorumlusu için Türkçe adım adım senaryolar, beklenen sonuçlar ve hata bildirme şablonu.
- Kayıt ve onay
- MFA kurulumu (emülatörde test edilemiyor, D5): e-posta doğrulama → QR ile kurulum → otomatik çıkış → kodla giriş; yanlış kod; 30 sn eski kod; ikinci adımda 5 dk bekleyip süre dolması; Authenticator kaybı → admin sıfırlaması (F7.1); kurulum sonrası callable'ların çalışması (`sign_in_second_factor`)
- Şifre sıfırlama e-postasının gerçek gönderimi ve Firebase eylem sayfası (dil Türkçe)
- Telefonla yoklama (iOS Safari + Android Chrome)
- Projektör (salon arkasından okunabilirlik)
- Sınav (yenileme dayanıklılığı, görsel)
- Materyal
- Admin işlemleri
- Askıya alma etkisinin anında görülmesi

- **✅ Uygulanan F10.1–F10.3 (sapmalar ve eklemeler):**
  - **F10.1 kanıt:** CI çalışması [#57](https://github.com/hansero/pediatrist/actions/runs/43108681873) (commit `279747c`): lint, biçim, typecheck, sahte veri bekçisi, birim testleri, iki derleme, kural testleri, functions testleri ve e2e adımlarının hepsi başarılı (e2e adımı 6 dk 24 sn).
    - Kapsam: 20 spec dosyasında 58 senaryo × 2 proje (masaüstü 1280 px, telefon 390 px) = 116. 113 koşar, 3'ü bilinçli atlanır:
      - `quiz-timeout.spec` telefonda (gerçek saatle ~70 sn sürer; ekran boyutundan bağımsız, masaüstünde koşar),
      - `nav.spec` "çekmece" testi masaüstünde (yalnızca dar ekran),
      - `nav.spec` "İçeriğe geç" testi telefonda (yalnızca geniş ekran).
    - Yeniden deneme yok (`retries: 0`): geçen test ilk denemede geçmiştir. Bu oturumdaki tam koşularda kararsız (flaky) test görülmedi; görülen tek e2e hatası gerçek bir uyumsuzluktu (F8.1, erişilebilir ad boşluğu) ve düzeltildi.
    - Bilinen altyapı riski: runner'ın Ubuntu paket aynasına erişememesi (F7.5 eki); Chromium önce başlatılarak denendiği için artık e2e'yi engellemiyor.
  - **F10.2:** `docs/revision/STAGING_CHECKLIST.md`. İşaretlenebilir tablo: proje ve hizmetler (12), yapılandırma (8), dağıtım (5), ilk admin ve kısa kontrol (3), operasyon (7), hukuk ve kurum kararları (5). Her satırda "nasıl doğrulanır". Komutlar tekrar edilmedi, `DEPLOY.md` bölümlerine gönderme yapıldı.
    - Plandaki maddelere eklenenler: `AUDIT_IP_SALT`, saklama süresi, TTL, kritik olay alarmı, PITR/yedek ve geri yükleme tatbikatı, "aynı ağ" işareti, hız sınırı, `KVKK_NOTICE_APPROVED`, üye silme sürecinin sahibi.
  - **F10.3:** `docs/revision/UAT_SCENARIOS.md`. 32 senaryo: kayıt/giriş/hesap güvenliği (8), yoklama (6), sınav (5), materyal (3), yönetim ve kişisel veriler (7), genel kullanım (3 — biri isteğe bağlı). Her senaryoda rol, adımlar, beklenen sonuç, G/K/A işareti; hata bildirme şablonu ve kabul ölçütü.
    - ⚠ işaretli 9 senaryo otomatik testlerde hiç denenemeyenlerdir (gerçek e-posta, TOTP, gerçek telefonda passkey, ders salonunda projektör, kod iletme, gerçek Storage'dan PDF).
    - "Beklenen" ifadeleri kodla karşılaştırıldı (ör. şifre sıfırlama kayıtlı olmayan adresi belli etmez; yoklamadan sonra form yerine "Yoklamanız alındı").
  - Bu üç adımda uygulama kodu değişmedi.

#### F10.4 Denetim izlenebilirliği (S)
`docs/revision/AUDIT.md` içindeki her bulgu için "kapatan commit + kanıt (test adı veya ekran)" tablosu `docs/revision/TRACEABILITY.md` dosyasına yazılır. Kapatılmayan bulgu varsa gerekçesi yazılır.

- **✅ Uygulanan F10.4 (sapmalar ve eklemeler):**
  - `docs/revision/TRACEABILITY.md`: AUDIT.md'deki 81 bulgu için durum, kapatan adım, kanıt ve not. Bölümler denetimle aynı (kritik, güvenlik, kullanılabilirlik, görsel hiyerarşi, tutarlılık, erişilebilirlik, performans/mimari, test/işletim, KVKK).
    - Sonuç: 72 kapandı, 8 kısmen, 1 kapanmadı (`minInstances`). Kapananların 8'i gerçek ortamda doğrulama bekliyor (🔎).
    - Kanıt olarak yazılan test adları depodaki testlerden derlenen dizinle (446 test adı) karşılaştırıldı; dosya başına test sayıları `grep` ile sayıldı.
    - "Açık kalanlar" bölümü üç başlıkta: yalnızca gerçek ortamda yapılabilenler (4), bilinçli olarak yapılmayanlar (10; neden ve risk sütunlarıyla), otomatik testle kanıtlanamayanlar (görsel/metin bulguları).
  - **Bulunan boşluk ve kapatılması:** erişilebilirlik denetimi sınav ekranının kendisini (sınav sürerken) ve karneyi kapsamıyordu. `e2e/quiz-exam.spec.ts`'e üç axe denetimi eklendi (sınav ekranı, cevapları kapalı karne, cevapları açık karne); hepsi temiz geçti.
  - Otomatik bağımlılık denetimi (Dependabot / CI'da `npm audit`) eklenmedi: depoda kendiliğinden PR/uyarı açacağı için kullanıcıya bırakıldı (TRACEABILITY "açık kalanlar").

---

### F11 — Kullanıcı revizyonları (2026-11-13)

Kullanıcının 7 maddelik isteği. Plan: oturumdaki onaylı plan dosyası; kararlar D23–D27.

#### F11.1 Yoklama cihazını (passkey) kaldır (L) — madde 1
- **✅ Uygulanan:**
  - **Sunucu:** `functions/src/webauthn.ts` silindi (3 callable). `verifyRealTimeAttendance` sözleşmesi `{sessionId, code}`; imza bloğu ve `no-device` / `challenge-expired` / `assertion-invalid` sonuçları kalktı; yöntem `code`. Kod denetimi, `alreadyRecorded`, IP işareti ve sayaçlar aynen.
  - `updateMemberAccess`'ten cihaz sıfırlama (`resetBoundDevice`, `MEMBER_DEVICE_RESET`), kayıttan `webauthn: null`, KVKK dökümünden `attendanceDeviceRegisteredAt`, üye silmeden challenge silme, `attendanceChallenge` hız kovası, `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGINS` parametreleri kaldırıldı. `@simplewebauthn/server` ve `/browser` bağımlılıkları silindi.
  - **İstemci:** `src/lib/webauthn.ts`, `/account/device` sayfası, kenar çubuğu bağlantısı, oturumdaki `hasBoundDevice`, üye panelindeki "Yoklama cihazını sıfırla" ve "Yoklama cihazı" sütunları, canlı listedeki cihaz sütunu, WebAuthn hata eşlemesi silindi. Eski denetim kaydı etiketleri (`ATTENDANCE_DEVICE_*`, `MEMBER_DEVICE_RESET`) okunur kalsın diye duruyor.
  - `Permissions-Policy`: `publickey-credentials-create=()`, `publickey-credentials-get=()`; `camera=(self)` QR için kaldı.
  - **KVKK:** "Cihaz bilgisi" maddesi çıktı, kamera maddesi eklendi ("yalnızca cihazınızda işlenir; kaydedilmez, gönderilmez"). `KVKK_NOTICE_VERSION` **1.1**: her üyeden yeniden onay istenir. `KVKK_NOTICE_APPROVED` hâlâ `false`.
  - **Operasyon:** `scripts/verify-staging.mjs` B7 artık WebAuthn parametresi istemiyor (kalmışsa uyarı); Storage CORS kökenleri `--origin` ile ya da varsayılan Hosting alan adlarından. Yeni `scripts/remove-attendance-device-data.ts`: kuru çalışma varsayılan, `--yes` ile `users/*.webauthn` ve `webauthn_challenges/*` silinir; `demo-` projeyi reddeder.
  - **Testler:** `webauthn.test.ts`, yazılım doğrulayıcı, `device.spec.ts`, sanal doğrulayıcı yardımcıları ve cihaz e2e'si silindi. functions: eski istemcinin `assertion`/`deviceId` alanları yok sayılır; MFA zorunluyken ikinci faktörsüz oturum yoklama veremez; aynı hekimden eşzamanlı iki istek → biri `alreadyRecorded`; hız sınırı `attendanceVerify` ile. unit: sözleşme alanları atılır, Permissions-Policy değerleri. rules: eski `webauthn_challenges` kapalı kalır.
  - Doğrulandı: lint, format, typecheck, no-mock, unit 254, rules 58, functions 103, e2e (yoklama, a11y, panel, KVKK, gezinme, CSP, oturum) 46 + 2 atlanan.

#### F11.2 Uygulama içi QR okuyucu (M) — madde 2
- **✅ Uygulanan:**
  - `src/lib/attendance/checkInLink.ts`: `checkInUrl` (projektörden taşındı) ve `parseCheckInLink`. Yalnızca bu kökenin `/attendance` bağlantısı kabul edilir; kod `ATTENDANCE_CODE_*` ile denetlenir. Telefonun kendi kamerasıyla gelen `?s=&c=` bağlantısı da aynı çözücüden geçer.
  - `src/components/attendance/QrScanner.tsx` (D27): "QR kodu okut" düğmesine basınca `getUserMedia` (arka kamera, karşılanamazsa herhangi bir kamera), önizleme, 200 ms'de bir ≤ 640 px kare `jsqr` 1.4.0 ile çözülür (okuyucu açılınca dinamik yüklenir). Bu dersin bağlantısı okununca kamera kapanır ve kod hemen gönderilir; yabancı QR / başka ders / bozuk kod için Türkçe ipucu, kamera açık kalır. Kamera; kapatma, başarı, sayfa arka plana alınma ve ayrılmada bırakılır. Güvenli bağlam veya kamera yoksa düğme yerine "kodu elle girin" notu.
  - `DoctorCheckIn`: okuyucu üstte, "veya kodu elle girin" ve kod alanı altta. Yoklama alınınca adresteki `?s=&c=` temizlenir. Sayfa alt başlığı ve projektör yardım metni güncellendi.
  - `lib/errors.ts › cameraErrorMessage`: izin reddi, kamera yok, kamera meşgul. Aynı adlı DOM hataları başka API'lerde farklı anlam taşıdığı için `toAppError`'a eklenmedi.
  - CSP değişmedi (çözümleme ana iş parçacığında; `MediaStream` `srcObject` ile).
  - **Testler:** unit +4 (çözücü gidiş-dönüş, yabancı köken/sayfa/şema, bozuk kod; kamera mesajları). e2e +2 × 2 ekran: (1) `e2e/fixtures/camera.ts` `getUserMedia`'yı bir canvas akışına bağlar; sayfa açılınca kamera istenmez, yabancı QR reddedilir, projektör QR'ı okununca düğmeye basmadan "Yoklamanız alındı", sayaç 1. (2) İzin reddi (`NotAllowedError`) → tam Türkçe mesaj, elle kodla katılım.
  - **Not:** başsız Chromium'da kamera aygıtı yok; gerçek API `NotFoundError` veriyor. Bu yüzden izin reddi e2e'de enjekte ediliyor. Gerçek telefonda izin akışı UAT B1.
  - Doğrulandı: lint, format, typecheck, no-mock, unit 258, e2e yoklama + CSP 22, ekran görüntüsüyle telefon düzeni.

#### F11.3 Ders kategorisini kaldır (S) — madde 3
- **✅ Uygulanan:**
  - `LECTURE_CATEGORIES` / `LectureCategory` silindi; `StartLectureSessionRequest`'te `category` yok (eski istemcinin gönderdiği alan atılır). Sunucu derse ve loglara kategori yazmıyor; tiplerde alan "eski kayıtlar" yorumuyla isteğe bağlı.
  - Başlatma formundan açılır liste kalktı; "Eğitici" ve "Yoklama süresi" yan yana. Canlı kart, projektör, hekim kartı ve ders raporu açıklamaları yalnızca eğiticiyi gösteriyor. Ders raporu ve hekim dökümü CSV'lerinden "Kategori" sütunu çıktı.
  - Aynı adımda kalan eski cihaz metinleri düzeltildi (başlatma kartı açıklaması, hekim dashboard'u "kayıtlı telefonunuzla").
  - Seed: seed dersinde kategori yok.
  - Testler: şema (kategori atılır), functions (derste `category` yok), CSV başlıkları (unit + e2e).
  - Doğrulandı: typecheck, lint, unit 258, functions 103, e2e yoklama + dashboard 22.

#### F11.4 Yoklama verme yetkisi (M) — madde 7
- `isAttendanceEligible` + `requireAttendee` (`"attendee"` erişim düzeyi), `expectedAttendees` süzgeci, uygun olmayan hedefe mazeret reddi, asistan olmayana kıdem atama reddi, menü/sayfa/dashboard, seed'e `Uzm. Dr.` hesabı.

#### F11.5 Materyal etiketleri (M) — madde 4
- `shared/materials.ts` normalizasyonu, `labels` alanı, `LabelInput`, hekim süzgecinde etiket, kullanılmayan `category` indeksi silinir.

#### F11.6 Hedef kitlede "Uzman" (M) — madde 6
- `targetSpecialists`, `materialAudienceOf`, okunma raporu ve zorunlu materyal hesabı, hekim süzgecinde "Uzman".

#### F11.7 Admin materyal süzgeci (S) — madde 5
- `filterAdminMaterials` (arama | etiket | hedef kıdem) + liste üstünde süzgeç satırı.

#### F11.8 Belgeler, izlenebilirlik, tam doğrulama (S)
- TRACEABILITY (S1, S2, C2), UAT, STAGING, README, DEPLOY, `Plan.MD`; bütün test paketleri.

---

## 6. Bulgu → Adım İzlenebilirlik Özeti

> Bu tablo planlama aşamasındaki eşlemedir. Her bulgunun gerçekleşen durumu, kanıtı ve açık kalanlar: [`TRACEABILITY.md`](TRACEABILITY.md).

| Bulgu | Adım(lar) |
|---|---|
| C1 sessiz fallback | F1.4, F4.3–4.4, F5.2–5.4, F6.2, F7.1, F7.5 |
| C2 yoklama mock | F4.1–F4.6 |
| C3 sınav mock + cevap anahtarı paketinde | F1.2, F5.1–F5.5 |
| C4 sahte MFA | F3.4 |
| C5 yetki kaynakları / gecikmeli iptal | F1.3, F2.1–F2.4 |
| C6 CSP | F2.5 |
| C7 süre atlatma / cevap sızıntısı | F2.1, F5.1 |
| C8 boşta kalma kilidi | F3.3, F4.3, F5.3 |
| C9 kayıt / davet | F2.3, F3.5 |
| C10 uydurma dashboard / admin | F7.1–F7.3 |
| C11 materyal dosya yok | F2.2, F6.1–F6.4 |
| S1–S2 cihaz / kod aktarımı | F4.2 (S2: ipHash işaretleme F1.3/F4.1) |
| S3–S5 yoklama tutarlılığı | F4.1 |
| S6–S7 sınav tutarlılığı | F5.1 |
| S8 girdi doğrulama | F1.1, F1.3 |
| S9 üye yönetimi korumaları | F2.3 |
| S10 denetim kaydı | F1.3, F9.2 |
| S11–S12 kural şemaları | F2.1 |
| S13 DRM etiketi | F6.3 |
| S14 lockfile / CVE | F0.1 |
| S15 analytics | F0.3 |
| Tutarlılık tablosu | F1.1, F1.2, F3.1 |
| Erişilebilirlik | F3.1, F8.1 |
| Performans / mimari | F0.3, F2.5, F8.2 |
| Test / CI | F0.2, F0.5, her fazın test adımı, F10.1 |
| KVKK | F3.5, F9.1 |

---

## 7. Revizyon Sırasında Bulunan Yeni Bulgular (N-kayıtları)

Denetimde (AUDIT.md) olmayan, uygulama çalıştırılınca ortaya çıkan sorunlar. Her biri ya bulunduğu adımda düzeltilir ya da ilgili adıma bağlanır.

| ID | Bulgu | Etki | Durum |
|---|---|---|---|
| N1 | `next.config.ts` CSP'si `'unsafe-eval'`'e izin vermediği için **uygulama `next dev` altında hiç hydrate olmuyordu**: hiçbir buton/form çalışmıyordu. | Uygulama yerelde hiç çalıştırılıp test edilmemiş. | ✅ F0.3'te düzeltildi (yalnızca geliştirme/emülatör ekleri) |
| N2 | Cloud Functions, `firebase-admin` namespace API'sini (`admin.firestore.FieldValue/Timestamp`) kullanıyordu. Functions emülatöründe bunlar `undefined` geliyor, bu yüzden **her yazma işlemi `TypeError` ile çöküyordu** (denetim kaydı, sayaçlar, zaman damgaları). Düz Node'da çalışıyor; sorun emülatörün admin SDK sarmalayıcısında. | Bütün backend emülatörde test edilemezdi. | ✅ F0.3'te düzeltildi: modüler import'lar (`firebase-admin/app`, `/auth`, `/firestore`; firebase-admin v12+ için önerilen API), davranış değişikliği yok |
| N3 | Formlar hydration tamamlanmadan gönderilirse tarayıcının varsayılan GET gönderimiyle sayfa yenileniyor (`/register?`). Input'larda `name` olmadığı için veri sızmıyor, ama kullanıcı "hiçbir şey olmadı" deneyimi yaşıyor. | UX; yavaş bağlantıda kafa karıştırıcı. | ✅ F3.1: `Button` hydration'a kadar `disabled` (`useHydrated`); login ve register gönder butonları taşındı; e2e buton etkinleşmesini bekliyor ve sunucu HTML'inde `disabled` olduğunu doğruluyor. Diğer formlar kendi fazlarında `Button`'a geçer |
| N5 | `defineBoolean(...).value()` ortam değişkeni yoksa **`false`** döner (`firebase-functions/lib/params/types.js` → `process.env[name] === "true"`); `default: true` yalnızca deploy sırasında kullanılır. `.value()` ile okunsaydı, değişkeni eksik bir ortamda App Check/MFA/e-posta zorunlulukları **sessizce kapanırdı**. | Güvenlik | ✅ F1.3: `guards.ts → isEnforced()` yalnızca açıkça `"false"` değerinde kapatır; testle doğrulandı |
| N6 | İstemci, şemanın isteğe bağlı alanlar için ürettiği `undefined` değerleri gönderiyordu; Firebase SDK'sı bunları **`null`**'a çeviriyor ve `.optional()` alanlar `null`'ı reddettiği için sunucu `invalid-argument` ("Geçersiz değer") dönüyordu. Örnek: boş davet kodu ile kayıt. | İsteğe bağlı alanı olan her callable | ✅ F2.3: `callFunction` → `stripUndefined`; birim testi + e2e kayıt testleri |
| N7 | zod 4 ilk nesne doğrulamasında `new Function("")` ile `eval` iznini yokluyor. Üretim CSP'sinde (`'unsafe-eval'` yok) hata yakalanıyor ama tarayıcı her sayfada `securitypolicyviolation` raporluyordu; F2.5 e2e CSP bekçisi buldu. | Gürültülü CSP raporları; ileride rapor toplayıcı (report-to) bağlanınca sahte alarm. | ✅ F2.5: `functions/src/shared/zod.ts` → `jitless: true`; doğrudan `zod` importu ESLint ile yasak |
| N8 | **MFA yalnızca callable'larda zorunlu, Firestore/Storage kurallarında değil.** Kurallar ortam parametresi okuyamıyor ve emülatör TOTP desteklemediği için kurallara `sign_in_second_factor` şartı koşulsuz eklenemiyor. Sonuç: şifresi ele geçirilmiş bir hesap, arayüzü atlayıp SDK ile **okuma** yapabilir (admin hesabıysa üye listesi, denetim kayıtları, sınav anahtarları). Bütün yazmalar zaten callable'da ve MFA istiyor. | Güvenlik (okuma) | ✅ Kullanıcı onayıyla uygulandı (D20, `rev(N8)`): `config/security` tek kaynak; kurallar (Firestore + Storage), `guards.ts` ve istemci aynı dokümanı okur; doküman yoksa MFA zorunlu. Testler: rules +8 (MFA'sız admin üye/denetim/davet/anahtar okuyamaz; kendi profili açık; varsayılan; config okuma/yazma; ilerleme yazımı; Storage okuma/yükleme), functions +1 (varsayılan ve bozuk değer), unit (parse), e2e (zorunlu ortamda kurulum sayfasına kilit). Mutasyon: kuraldan `mfaSatisfied()` çıkarılınca 4 test düşüyor. |
| N4 | Storage emülatörü başlarken "Unexpected rules runtime error" uyarısı veriyor; içerik yalnızca ortamın `JAVA_TOOL_OPTIONS` satırı. | Yok | ✅ F0.4'te doğrulandı: Storage kuralları doğru değerlendiriliyor (aktif kullanıcıya izin, bekleyene `storage/unauthorized`). Uyarı zararsız. |

