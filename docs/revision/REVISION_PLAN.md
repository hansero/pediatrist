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
| F4.3 | Admin: ders başlat/bitir + projektör kiosk sayfası (QR, wake lock) | M | ⬜ | C2, C8 (projektör) |
| F4.4 | Hekim: QR deep-link ile yoklama + kişisel geçmiş | M | ⬜ | C2 |
| F4.5 | Ders/katılımcı raporları + CSV | M | ⬜ | C2, Kullanılabilirlik |
| F4.6 | Yoklama e2e testleri + mock bekçisi temizliği | M | ⬜ | §8 |
| **F5** | **Sınav modülü (gerçek)** | | | |
| F5.1 | Backend: soruların attempt ile teslimi, `revealPolicy`, taslak kayıt, transaction | L | ⬜ | C3, C7, S6, S7 |
| F5.2 | Admin sınav stüdyosu (taslak, yayın, kapatma, görsel yükleme, arşiv) | L | ⬜ | C3 |
| F5.3 | Sınav ekranı (sunucu süresi, kalıcı yanıtlar, görseller, uyarılar) | M | ⬜ | C3, C8 (sınav) |
| F5.4 | Hekim paneli + karne + admin analitiği | M | ⬜ | C3, Kullanılabilirlik |
| F5.5 | Sınav testleri + mock bekçisi temizliği | M | ⬜ | §8 |
| **F6** | **Materyaller modülü (gerçek)** | | | |
| F6.1 | Backend callable'ları + kurallar | M | ⬜ | C11, S12 |
| F6.2 | Admin yükleme / düzenleme / silme / okunma raporu | M | ⬜ | C11 |
| F6.3 | Görüntüleyici (pdf.js / video) + ilerleme takibi | L | ⬜ | C11, S13 |
| F6.4 | Materyal testleri + mock bekçisi temizliği | S | ⬜ | §8 |
| **F7** | **Admin paneli, dashboard, hesaplayıcılar** | | | |
| F7.1 | Üye paneli (onay/askı/rol, onay diyalogları) + davet yönetimi | M | ⬜ | C10, Kullanılabilirlik |
| F7.2 | Denetim kaydı görüntüleyici (gerçek `audit_logs`) | S | ⬜ | C10 |
| F7.3 | Durum odaklı dashboard + gerçek KPI'lar | M | ⬜ | C10, Görsel hiyerarşi |
| F7.4 | Hesaplayıcılar: dürüst "yakında" durumu + `calculators_config` | S | ⬜ | Kullanılabilirlik |
| F7.5 | `invokeWithFallback` ve tüm fallback'lerin silinmesi; bekçi listesi boş | S | ⬜ | C1 (final) |
| **F8** | **Erişilebilirlik, metin, performans cilası** | | | |
| F8.1 | UX metni sadeleştirme + a11y düzeltmeleri + axe testleri | M | ⬜ | Görsel hiyerarşi, Erişilebilirlik |
| F8.2 | Performans (timer izolasyonu), ölü kod, `admin.ts` kararı | S | ⬜ | §7 |
| **F9** | **Uyum (KVKK) ve operasyon** | | | |
| F9.1 | Aydınlatma metni, rıza sürümü, üye silme ve veri dışa aktarımı | M | ⬜ | §9 |
| F9.2 | Denetim kaydı TTL, hız sınırı, alarm, yedekleme runbook'u | S | ⬜ | S10, §8 |
| F9.3 | README, `DEPLOY.md`, `Plan.MD` gerçeğe uygun güncelleme | S | ⬜ | §8 |
| **F10** | **Gerçek teste hazırlık** | | | |
| F10.1 | Tam e2e paketi CI'da yeşil | M | ⬜ | Hepsi |
| F10.2 | Staging Firebase projesi kurulum kontrol listesi | S | ⬜ | Hepsi |
| F10.3 | Kullanıcı kabul testi (UAT) senaryoları | S | ⬜ | Hepsi |
| F10.4 | Denetim izlenebilirlik kontrolü (her bulgu → kanıt) | S | ⬜ | Hepsi |

---

## 2. Son Oturum Devir Notu

> Her oturum sonunda **üzerine yazılır**. Kısa ve tam olarak eyleme dönük olmalı.

- **Tarih:** 2026-11-10
- **Son tamamlanan adım:** F4.2. Yoklama cihazı = WebAuthn platform passkey'i (sunucuda imza, UV, köken, sayaç, tek kullanımlık ve derse bağlı challenge); `localStorage` cihaz sırrı ve sahte biyometrik/simülasyon arayüzü kaldırıldı; `/account/device`. Testler: unit 181, rules 50, functions 72, e2e 50 (+2 ekran boyutuna özel atlanan).
- **Devam eden adım:** —
- **D21 uygulandı:** e-posta doğrulama zorunluluğu da `config/security`'de (`rev(D21)`).
- **Sıradaki iş:** F4.3 (M) admin: ders başlat/bitir + projektör kiosk sayfası:
  - `src/app/(protected)/attendance/projector/[sessionId]/page.tsx` (veya `/attendance/projektor`): tam ekran (Fullscreen API), Screen Wake Lock, büyük monospace kod (~15–20vw), QR kod (`qrcode`; içerik: `/attendance?s=<sessionId>&c=<kod>` deep-link, F4.4 kullanır), `Countdown` ile yenilenmeye kalan süre; `getProjectorCode`'u `msUntilRotation`'a göre zamanlayarak çağırır; `useIdleExempt()`.
  - Admin ders başlatma formu `Field`/`Button` ile (süre sınırı `LIMITS.lectureMinutes`), canlı ders kartı ve "Dersi bitir" (`ConfirmDialog`); canlı ders Firestore'dan dinlenir (`attendance_sessions where status == live`), `CLINIC_ROSTER` ve `INITIAL_SESSIONS` mock'ları bu ekrandan kalkar; denetim/rapor kısmı F4.5.
  - `AdminLiveAttendanceProjector.tsx` allowlist'ten düşer (F4.3).
  - e2e: admin ders başlatır → projektör sayfası kod ve QR gösterir → kod sunucudaki ile aynı (`computeSlotCode` e2e yardımcısında aynı HMAC) → dersi bitir.
- **Ortamı çalıştırma:** `npm run emulators` → `npm run seed` → `npm run dev`; testler: `npm run test:rules | test:functions | test:e2e`.
- **Engeller / notlar:** Zaman aşımıyla kesilen e2e `next-server`'ı açık bırakabilir → önce `pkill -f next-server`. Bildirim bölgesi (`ToastProvider`) her sayfada `role="status"`/`role="alert"` taşır: e2e'de `getByRole("status")` metinle süzülmeli. Yeni e2e spec'leri `./fixtures/test`'ten import etmeli (CSP bekçisi); ek tarayıcı bağlamları `guardedContext()` ile. Admin paneli hâlâ mock karışık (F7.1); e2e onu yalnızca gerçek callable'ları tetiklemek için kullanıyor.

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
| D6 | Yoklama cihaz bağlama WebAuthn platform passkey'leri ile yapılır (`@simplewebauthn/server` + `@simplewebauthn/browser`). `localStorage` sırrı kaldırılır. e2e testlerinde Playwright CDP sanal doğrulayıcısı kullanılır. | AUDIT S1, C2 | Evet |
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

#### F4.4 Hekim yoklama ekranı (M)
- **Dosyalar:** `src/components/attendance/DoctorCheckIn/*`
- **Yapılacaklar:**
  - Canlı oturum dinlenir. `?s=&c=` parametreleri varsa kod alanı otomatik dolar.
  - Kod alanı: `autoCapitalize="characters"`, `autoComplete="one-time-code"`.
  - Gönderimde WebAuthn assertion alınır, ardından `verifyRealTimeAttendance` çağrılır. Sunucu sonucu ya da hatası gösterilir.
  - Mobilde yoklama kartı en üstte yer alır.
  - Kişisel geçmiş: `attendance_logs where uid==me orderBy sessionStartedAt desc` (indeks mevcut).
  - Sahte "kamera ile tara" butonu silinir. Gerçek tarama telefonun kendi kamera uygulamasıyla QR üzerinden deep-link'tir.

#### F4.5 Raporlar (M)
- **Dosyalar:** `src/components/attendance/reports/*`
- **Yapılacaklar:**
  - Ders bazlı rapor: `attendance_sessions` (sayfalı) + seçilen dersin `records` alt koleksiyonu. Oran paydası `expectedAttendees.length`.
  - Katılımcı bazlı rapor: `attendance_logs where uid==X` + o kullanıcının beklenen oturum sayısı.
  - <%70 uyarısı gerçek veriyle hesaplanır.
  - CSV, `downloadCsv` (`;`) ile alınır.

#### F4.6 Yoklama testleri (M)
- **Dosyalar:** `e2e/attendance.spec.ts`
- **Senaryo:**
  - Admin context (1280px) dersi başlatır → projektör açılır → kod okunur.
  - Hekim context (iPhone emülasyonu, sanal doğrulayıcı) deep-link ile yoklama verir → admin listesi canlı güncellenir.
  - Yanlış kod hata mesajı verir. Süresi geçmiş kod reddedilir.
  - Mazeret işaretlenir → rapor oranları doğrulanır → CSV indirilir.
- Allowlist'ten `attendance/*` dosyaları çıkarılır.

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

#### F5.4 Hekim paneli, karne, admin analitiği (M)
- **Dosyalar:** `src/components/quizzes/doctor/*`, `src/components/quizzes/report/*`, `src/components/quizzes/admin/Analytics.tsx`
- **Yapılacaklar:**
  - Hekim kartı duruma göre değişir: *yayında sınav yok / başlanmadı / devam ediyor (kalan süre, devam et) / teslim edildi (karne)*.
  - Geçmiş: `quiz_attempts where uid==me orderBy submittedAt desc`.
  - Karne `getAttemptReport` ile alınır. `after_close` politikasında "Doğru cevaplar sınav kapandığında açılacak" yazar.
  - Gelişim grafiği erişilebilir bir tablo yedeğiyle birlikte gösterilir.
  - Admin analitiği `quiz_attempts` ile **uid'e göre** gruplanır, sayfalı ve filtrelidir. Karne inceleme için `getAttemptReport` kullanılır. Uydurma karne üretimi (`sampleGraded`) **silinir**.

#### F5.5 Sınav testleri (M)
- **Dosyalar:** `e2e/quiz.spec.ts`
- **Senaryo:**
  - Admin CSV ve görsel yükler → önizler → `after_close` ile yayınlar.
  - Hekim sınava başlar → yanıtlar → sayfayı yeniler → yanıtlar korunmuştur → teslim eder → doğru cevapları göremez.
  - Admin sınavı kapatır → hekim tam karneyi görür.
  - `immediate` politikasıyla ikinci bir akış.
  - Süre dolumu otomatik teslimi.
- Allowlist'ten `quizzes/*` çıkarılır.

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

#### F6.2 Admin yönetimi (M)
- **Dosyalar:** `src/components/materials/admin/*`
- **Yapılacaklar:**
  - Dosya seçici, `uploadBytesResumable` ile ilerleme çubuğu, iptal.
  - Kategori, hedef kıdem, zorunluluk ve indirme izni seçimi; kategori ortak listeden gelir.
  - Düzenle ve sil (onay diyaloğu ile).
  - Okunma raporu: `collectionGroup('progress')` veya materyal bazlı `progress` sorgusu. Hedef kitle = hedef kıdemdeki aktif asistanlar.

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

#### F6.4 Materyal testleri (S)
- **Dosyalar:** `e2e/materials.spec.ts`
- **Senaryo:**
  - Admin PDF yükler → hekim (doğru kıdem) görür, açar, sayfaları gezer → tamamlandı → admin raporu güncellenir.
  - Hedef dışı kıdemdeki hekim varsayılan filtrede materyali görmez.
  - Admin materyali siler → Storage'dan da silinir.
- Allowlist'ten `materials/*` çıkarılır.

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

#### F7.3 Dashboard (M)
- **Dosyalar:** `src/app/(protected)/dashboard/page.tsx`, `src/components/dashboard/*`
- **Yapılacaklar:**
  - Ana kart duruma göre tek bir birincil eylem gösterir: canlı ders varsa "Yoklamaya katıl", yayında sınav varsa "Sınava başla / devam et", yoksa yaklaşan zorunlu materyal.
  - **KPI'lar** `getCountFromServer` / `getAggregateFromServer(average)` ile hesaplanır:
    - Admin: bekleyen üye sayısı, son 30 gün katılım oranı, aktif sınav katılımı.
    - Hekim: sınav ortalaması, tamamlanan zorunlu materyal, katılım oranı.
  - Her KPI boş durum ve yükleniyor halini destekler. Sabit sayı **yoktur**.

#### F7.4 Hesaplayıcılar (S)
- **Dosyalar:** `src/app/(protected)/calculators/page.tsx`, `src/lib/pediatrics/index.ts`, `functions/src/calculatorsService.ts` (opsiyonel)
- **Yapılacaklar:**
  - D8 uygulanır: kartlar "Yakında" olarak gösterilir. "Maksimum doz güvenlik kilidi aktif" gibi çalışmayan özellik iddiaları kaldırılır; bunlar "planlanan" olarak etiketlenir.
  - Admin protokol notu `calculators_config/{id}` dokümanına **callable ile** kaydedilir (`updateCalculatorConfig`; F2.1'de kural admin yazımını da kapattı, denetim kaydı için).
  - Katalogdaki statik tanımlar ürün metadata'sıdır (mock değildir) ve kalabilir.

#### F7.5 Fallback temizliği (S)
- **Yapılacaklar:**
  - `invokeWithFallback`, `FALLBACK_*`, `isFirebaseConfigured` ile gizlenen "demo" yolları silinir.
  - Firebase yapılandırılmamışsa uygulama açık bir yapılandırma hata sayfası gösterir.
  - `scripts/no-mock-allowlist.json` **boş** hale gelir ve silinir. Bekçi artık istisnasız çalışır.
- **Doğrulama:** `npm run check:no-mock` ve tüm test paketleri yeşil.

---

### F8 — Erişilebilirlik, metin, performans

#### F8.1 Metin ve erişilebilirlik (M)
- **Yapılacaklar:**
  - Tüm UI metinleri gözden geçirilir: butonlar 1–3 kelime olur, jargon kaldırılır, hata mesajları "ne oldu + ne yapmalı" formatına getirilir.
  - Durum renkleri yalnızca durum için kullanılır; başlık üstü etiketler nötr stildedir.
  - Etiketsiz kontroller etiketlenir. Sekmeler, fieldset'ler ve tablo başlıkları erişilebilir hale getirilir.
  - `e2e/a11y.spec.ts`: her ana sayfada `@axe-core/playwright` çalışır, **0 serious/critical** ihlal hedeflenir.

#### F8.2 Performans ve ölü kod (S)
- **Yapılacaklar:**
  - Saniyelik zamanlayıcılar yalnızca `Countdown` bileşeninde kalır.
  - Büyük listelerde sayfalama yapılır.
  - `src/lib/firebase/admin.ts` ve `firebase-admin`/`server-only` kök bağımlılıkları: kullanılmıyorsa silinir.
  - **Karar notu:** sunucu tarafı rota koruması (session cookie + middleware) bu revizyonda **yapılmaz**. Veri koruması kurallardadır. İleride gerekirse ayrı bir faz olarak eklenir.
  - Nonce tabanlı CSP denenir: kırılma yoksa `'unsafe-inline'` kaldırılır; kırılıyorsa gerekçesi D-kayıtlarına yazılır.
  - `verifyRealTimeAttendance` için `concurrency` ve `minInstances` ayarları belgelenir.

---

### F9 — Uyum ve operasyon

#### F9.1 KVKK (M)
- **Yapılacaklar:**
  - `/kvkk` aydınlatma metni. Metin **kurumun hukuk birimi tarafından onaylanmalıdır**; taslak işaretiyle yayınlanır.
  - Rıza sürümü `users/{uid}.consent = {version, acceptedAt}` alanında tutulur.
  - Sürüm değişince yeniden onay istenir.
  - `deleteMember` callable'ı: Auth kullanıcısı silinir, profil anonimleştirilir, attempt/log/progress kayıtlarında ad alanları temizlenir, denetim kaydı yazılır.
  - `exportMemberData` callable'ı: JSON dışa aktarım.

#### F9.2 Operasyon (S)
- **Yapılacaklar:**
  - `audit_logs` için `expireAt` alanı ve Firestore TTL politikası (süre `DEPLOY.md`'de karar olarak yazılır, örn. 2 yıl).
  - Hız sınırı: uid başına dakikalık sayaç dokümanı (yoklama ve kod denemeleri için). Hassas callable'larda `consumeAppCheckToken: true`.
  - **`ipHash` (F1.3'ten devredildi):** `sha256(salt + rawRequest.ip)`; salt `defineSecret('AUDIT_IP_SALT')`. Emülatör için `functions/.secret.local` gerekir (git'e girmez); seed/README'ye kurulum adımı yazılır veya emülatörde sabit test tuzu kullanılır. S2'deki aynı IP işaretlemesi de bunu kullanır.
  - Log tabanlı alarm (`severity=CRITICAL`), bütçe alarmı ve zamanlanmış Firestore yedeği/PITR, `DEPLOY.md`'de adım adım anlatılır.

#### F9.3 Dokümantasyon (S)
- **Yapılacaklar:**
  - `README.md`: kurulum, emülatör, seed, test komutları, mimari özet.
  - `DEPLOY.md`: deploy sırası (rules → indexes → functions → hosting) ve ilk admin oluşturma (konsolda `users/{uid}` dokümanına `role:'admin', status:'active'` yazılır; `syncUserClaims` claim'leri ayarlar).
  - `Plan.MD`: "Tamamlandı" işaretleri gerçeğe göre düzeltilir ve bu plana link verilir.

---

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

#### F10.4 Denetim izlenebilirliği (S)
`docs/revision/AUDIT.md` içindeki her bulgu için "kapatan commit + kanıt (test adı veya ekran)" tablosu `docs/revision/TRACEABILITY.md` dosyasına yazılır. Kapatılmayan bulgu varsa gerekçesi yazılır.

---

## 6. Bulgu → Adım İzlenebilirlik Özeti

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

