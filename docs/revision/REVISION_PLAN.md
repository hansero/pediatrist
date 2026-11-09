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
| F0.1 | Bağımlılıklar, lockfile'lar, kullanılmayan paketler | S | ⬜ | S14, §7 |
| F0.2 | Lint / typecheck / test script'leri + CI workflow | S | ⬜ | §8 |
| F0.3 | İstemcinin emülatöre bağlanması + App Check debug + `.env` | S | ⬜ | §7 |
| F0.4 | Emülatör seed script'i (test verisi YALNIZCA burada) | M | ⬜ | (mock'ların yerine) |
| F0.5 | Eski sahte testleri kaldır, test iskeletleri + "no-mock" bekçisi | M | ⬜ | §8 |
| **F1** | **Ortak domain ve API sözleşmeleri** | | | |
| F1.1 | `functions/src/shared`: sabitler, tipler, zod şemaları, `@shared` alias | M | ⬜ | Tutarlılık tablosu |
| F1.2 | Ortak CSV doğrulayıcı + birim testleri | S | ⬜ | Tutarlılık (CSV) |
| F1.3 | Functions: `guards.ts`, `validate.ts`, tüm callable'ların refactor'u | M | ⬜ | C5 (kısmen), S8 |
| F1.4 | İstemci `callables.ts` yeniden yazımı, `AppError`, `useAsyncAction` | S | ⬜ | C1 (temel) |
| **F2** | **Yetkilendirme temeli** | | | |
| F2.1 | `firestore.rules` yeniden yazımı + rules testleri | L | ⬜ | C5, C7 (kural), S11, S12, C9 (davet) |
| F2.2 | `storage.rules` yeniden yazımı + testler | S | ⬜ | C5, C11 (silme/MIME) |
| F2.3 | Claim senkronu, `tokensValidAfter`, üye yönetimi korumaları, sunucu tarafı kayıt, davetler | L | ⬜ | C5, C9, S9 |
| F2.4 | `ClinicSessionContext` yeniden yazımı (canlı profil, token yenileme) | M | ⬜ | C5 |
| F2.5 | Tek kaynaklı CSP, header'lar, SSR bölgesi | S | ⬜ | C6, §7 bölge |
| **F3** | **UI temeli ve kimlik doğrulama UX** | | | |
| F3.1 | Tasarım token'ları, kontrast/odak, `next/font`, UI primitifleri | L | ⬜ | Tutarlılık, Erişilebilirlik |
| F3.2 | Korumalı layout: `next/link`, aktif menü, mobil çekmece, hata/404/yükleniyor | M | ⬜ | Kullanılabilirlik |
| F3.3 | `SessionGuard` yeniden yazımı (uyarı, muafiyet, odak tuzağı) | S | ⬜ | C8 (temel) |
| F3.4 | Giriş: gerçek hata yönetimi, şifre sıfırlama, gerçek TOTP MFA | L | ⬜ | C4 |
| F3.5 | Kayıt, KVKK onayı, e-posta doğrulama, bekleme/askı ekranları | M | ⬜ | C9, Kullanılabilirlik |
| **F4** | **Yoklama modülü (gerçek)** | | | |
| F4.1 | Backend sağlamlaştırma (transaction, kilit, süre dolumu, zamanlayıcı) | M | ⬜ | S3, S4, S5, S10 |
| F4.2 | WebAuthn passkey ile cihaz bağlama | L | ⬜ | S1, C2 (biyometrik) |
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

- **Tarih:** 2026-11-09
- **Son tamamlanan adım:** — (plan oluşturuldu; henüz kod değişikliği yok)
- **Devam eden adım:** —
- **Sıradaki iş:** F0.1'e başla.
- **Engeller / notlar:** Firebase emülatör jar'larının indirilmesi ağ politikası tarafından engellenirse F0.3'te not et ve ortam ağ izni iste.

---

## 3. Kalıcı Kararlar (D-kayıtları)

Bu kararlar bütün adımlar için geçerlidir. Değiştirmek için kullanıcı onayı gerekir. Değişiklik yapılırsa buraya tarih ve gerekçe ile eklenir.

| ID | Karar | Gerekçe | Kullanıcı değiştirebilir mi? |
|---|---|---|---|
| D1 | **Uygulama kodunda (`src/`, `functions/src/`) hiçbir mock, seed, `INITIAL_*`, `FALLBACK_*`, sahte isim veya istemci tarafında üretilmiş "başarılı" yanıt bulunmaz.** Test verisi yalnızca `scripts/seed-emulator.ts` içinde ve yalnızca emülatöre yazılır. | Kullanıcı talebi + AUDIT C1, C10 | Hayır |
| D2 | Ortak kod `functions/src/shared/` altında durur. Next tarafı `@shared/*` alias'ı ile import eder. | Functions deploy'u yalnızca `functions/` klasörünü yükler; ortak kod orada olmalı. | Evet |
| D3 | Yetkinin tek kaynağı `users/{uid}` dokümanıdır. Claim'ler önbellektir. Anında iptal `tokensValidAfter` (saniye) ile `request.auth.token.auth_time` karşılaştırılarak yapılır. | AUDIT C5 | Hayır |
| D4 | Kayıt, istemcide `createUserWithEmailAndPassword` ve ardından `completeRegistration` callable'ı ile yapılır. Profil dokümanını sunucu yazar. İşlem idempotenttir: profil eksikse girişte tekrar çağrılır. İstemcinin `users` koleksiyonuna doğrudan `create` izni kaldırılır. | AUDIT C9, S11. Blocking function Identity Platform gerektirir ve emülatörde daha zordur. | Evet |
| D5 | MFA, Identity Platform TOTP ile gerçek olarak uygulanır. Zorunluluk `REQUIRE_MFA` parametresiyle yönetilir: staging/prod'da `true`, emülatörde `false`. Bunun sebebi, Auth emülatörünün TOTP desteğinin sınırlı olmasıdır (F3.4'te doğrulanacak). Sahte TOTP adımı tamamen silinir. | AUDIT C4 | Evet (MFA'sız devam seçilirse ekran ve iddialar tamamen kaldırılır) |
| D6 | Yoklama cihaz bağlama WebAuthn platform passkey'leri ile yapılır (`@simplewebauthn/server` + `@simplewebauthn/browser`). `localStorage` sırrı kaldırılır. e2e testlerinde Playwright CDP sanal doğrulayıcısı kullanılır. | AUDIT S1, C2 | Evet |
| D7 | Sınav sonucunun gösterimi her sınav için `revealPolicy` ile belirlenir: `after_close` (varsayılan; sınav kapanana kadar yalnızca puan ve doğru/yanlış görünür) veya `immediate` (anında tam karne). Doğru cevaplar istemci paketine hiçbir koşulda girmez. | AUDIT C7. Plan.MD'deki "anında karne" isteği korunur, varsayılan güvenli seçenektir. | Evet |
| D8 | Hesaplayıcı formül motoru bu revizyonun kapsamı dışındadır. Sayfa dürüst bir "Yakında" durumu gösterir. Admin protokol notları `calculators_config`'e gerçekten kaydedilir. Formül motoru ayrı bir faz olarak (F11, opsiyonel) eklenebilir. | Klinik risk; doğrulama ve referans değer testleri gerektirir. | Evet |
| D9 | CSP tek kaynaktan, `next.config.ts` üzerinden verilir. `firebase.json` içindeki `hosting.headers` kaldırılır. | AUDIT C6 | Hayır |
| D10 | Bölge: Functions ve SSR `europe-west1`. Firestore konumu staging kurulumunda `eur3` veya `europe-west1` seçilir. | KVKK, gecikme | Evet |
| D11 | Materyal koruması "filigranlı görüntüleme" olarak etiketlenir. "DRM" ifadesi kullanılmaz. `allowDownload` yalnızca indirme butonunu kontrol eder. | AUDIT S13. Dürüst etiketleme. | Evet |
| D12 | Callable hataları kullanıcıya her zaman gösterilir. Bir mutasyonun sonucu sunucudan onay gelmeden "başarılı" olarak gösterilmez (iyimser UI yok). | AUDIT C1 | Hayır |
| D13 | App Check zorunluluğu `ENFORCE_APP_CHECK` parametresiyle yönetilir: prod'da `true`, emülatörde `false`. İstemci emülatörde debug sağlayıcıyı kullanır. | Emülatörde test edilebilirlik | Hayır |
| D14 | Commit formatı `rev(Fx.y): <özet>`. Her adım en az bir commit'tir ve her commit'ten sonra push yapılır. | Oturumlar arası devamlılık | Hayır |

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
  - Functions dependencies: `zod`, `@simplewebauthn/server`. Functions devDependencies: `firebase-functions-test`, `vitest`.
  - `next` ve `react`'i en güncel yamalı 15.x / 19.x sürümüne sabitle, ardından `npm audit` çalıştır.
  - `engines.node: "22"` ekle (kök).
  - Playwright notu: ortamdaki önceden kurulu Chromium kullanılacak. `@playwright/test` sürümü ortamdakiyle uyuşmazsa config'te `executablePath: '/opt/pw-browsers/chromium'` kullan. `playwright install` **çalıştırma**.
- **Doğrulama:** `npm ci && npm --prefix functions ci && npm audit --omit=dev`

#### F0.2 Script'ler ve CI (S)
- **Dosyalar:** `package.json` scripts, `.eslintrc.json` (veya `eslint.config.mjs`), `.prettierrc`, `.github/workflows/ci.yml`, `functions/package.json` scripts
- **Script'ler:**
  - `lint`, `typecheck` (`tsc --noEmit` + `npm --prefix functions run typecheck`), `test:unit` (vitest), `test:rules`, `test:functions`, `test:e2e`, `emulators`, `seed`, `check:no-mock`.
  - `test:rules`, `test:functions` ve `test:e2e`, `firebase emulators:exec --only auth,firestore,storage,functions "<komut>"` ile sarmalanır.
- **CI:** Node 22 → `npm ci` (iki paket) → lint → typecheck → unit → `emulators:exec` içinde rules, functions ve e2e → build.
- **Doğrulama:** `npm run lint && npm run typecheck` (mevcut kodda çıkan lint hataları ya düzeltilir ya da ilgili faza not edilir; kural kapatılmaz).

#### F0.3 İstemcinin emülatöre bağlanması (S)
- **Dosyalar:** `src/lib/firebase/client.ts`, `.env.example`, `firebase.json` (emulators bölümü)
- **Yapılacaklar:**
  - `NEXT_PUBLIC_USE_EMULATORS=true` olduğunda `connectAuthEmulator`, `connectFirestoreEmulator`, `connectStorageEmulator` ve `connectFunctionsEmulator` çağrılır (tek seferlik, modül seviyesinde memoize).
  - Emülatörde `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` ayarlanır.
  - `initPediatristFirebase()` modül seviyesinde memoize edilir (AUDIT §7).
  - `.env.example`'a `NEXT_PUBLIC_USE_EMULATORS`, `NEXT_PUBLIC_REQUIRE_MFA` ve `NEXT_PUBLIC_WEBAUTHN_RP_ID` eklenir. `MEASUREMENT_ID` kaldırılır (S15).
  - Functions parametreleri (`defineBoolean`): `ENFORCE_APP_CHECK`, `REQUIRE_MFA`, `REQUIRE_EMAIL_VERIFIED`. Emülatör değerleri `functions/.env.local` içinde verilir (gitignore'da).
- **Doğrulama:** `npm run emulators` ayağa kalkar; `npm run dev` ile emülatöre bağlanılır (Auth emülatör UI'da kullanıcı oluşur). **Risk:** jar indirme engellenirse ⛔ işaretle ve ağ izni iste.

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
- **Doğrulama:** `npm run emulators` + ayrı terminalde `npm run seed` → Emülatör UI'da dokümanlar görünür.

#### F0.5 Test iskeleti ve "no-mock" bekçisi (M)
- **Dosyalar:**
  - Silinecek: `tests/verify-platform.mjs` (kaynak kodu string-grep'leyen, mantığı kopyalayan ve başka bir makineye ait mutlak yol içeren test).
  - Yeni: `vitest.config.ts`, `tests/unit/`, `tests/rules/` (`@firebase/rules-unit-testing`), `functions/test/` (`firebase-functions-test`, gerçek modülleri import eder), `e2e/` (`playwright.config.ts`, `fixtures/auth.ts` ile emülatörde kullanıcı girişi), `scripts/check-no-mock.mjs`.
- **No-mock bekçisi:** `src/` ve `functions/src/` içinde şu desenleri arar: `INITIAL_`, `FALLBACK_`, `invokeWithFallback`, `Selim Kaya`, `Elif Demir`, `Burak Şahin`, `Mert Yılmaz`, `Ayşe Aksoy`, `uid_user_`, `uid_admin_`, `att_session_`, `quiz_active_current`, `Math.random(` (attendance), `hmacSlotCode`, `sampleGraded`, `76 / 100`.
  - Mevcut ihlaller `scripts/no-mock-allowlist.json` dosyasına **dosya bazında** yazılır.
  - Her modül fazı kendi dosyalarını listeden çıkarır. F7.5'te liste **boş** olur ve dosya silinir.
- **Doğrulama:** `npm run test:unit` (en az parser testleri), `npm run check:no-mock` (yalnızca allowlist dışında ihlal varsa kırmızı).

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

#### F1.4 İstemci çağrı katmanı (S)
- **Dosyalar:** `src/lib/firebase/callables.ts`, `src/lib/errors.ts`, `src/hooks/useAsyncAction.ts`
- **Yapılacaklar:**
  - `callable(name, ReqSchema, ResSchema)` yanıtı zod ile doğrular. Hata durumunda `AppError {code, message}` fırlatır. `toUserMessage` Türkçe kod eşlemesine genişletilir.
  - `useAsyncAction` hook'u `{run, pending, error, data, reset}` döndürür.
  - `getOrCreateClientDeviceSecret` F4.2'de silinir.
  - `invokeWithFallback` `@deprecated` olarak işaretlenir. Modül fazlarında çağrı yerleri tek tek kaldırılır, F7.5'te tamamen silinir.
- **Doğrulama:** typecheck + `tests/unit/callables.test.ts` (hata eşleme).

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
- **Doğrulama:** `npm run test:rules`

#### F2.2 Storage kuralları (S)
- **Dosyalar:** `storage.rules`, `tests/rules/storage.test.ts`
- **Yapılacaklar:**
  - Yetki `firestore.get(/databases/(default)/documents/users/$(request.auth.uid))` ile doküman üzerinden kontrol edilir (D3). Deploy sırasında cross-service IAM izni onaylanmalı; `DEPLOY.md`'ye not düşülür.
  - `materials/{materialId}/{file}`: `read` aktif üye. `create, update` admin + boyut + MIME (pdf, video/*, image/*, pptx). `delete` admin.
  - `quiz_media/{file}`: `read` aktif üye. `create` admin + image/* + ≤15 MB. `delete` admin.
- **Doğrulama:** `npm run test:rules`

#### F2.3 Kimlik sunucu tarafı (L)
- **Dosyalar:** `functions/src/authTriggers.ts` → `functions/src/members.ts`, `functions/src/index.ts`, `functions/test/members.test.ts`
- **Yapılacaklar:**
  - `onClinicMemberCreated` → `syncUserClaims` olarak yeniden adlandırılır (`onDocumentWritten`). `status` veya `role` değişince claim'leri günceller, `revokeRefreshTokens` çağırır ve `tokensValidAfter = now()` yazar.
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

#### F3.2 Korumalı layout (M)
- **Dosyalar:** `src/app/(protected)/layout.tsx`, `src/components/nav/*`, `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/(protected)/loading.tsx`
- **Yapılacaklar:**
  - `next/link` + `usePathname` ile `aria-current="page"` ve `.active` sınıfı.
  - ≤960px'te hamburger + çekmece (veya alt sekme çubuğu).
  - Tüm sayfalardan "Modül X • /route" çipleri kaldırılır.
  - Oturum yokken yönlendirme `router.replace` ile yapılır.
- **Doğrulama:** e2e `nav.spec.ts` (390px ve 1280px).

#### F3.3 SessionGuard (S)
- **Dosyalar:** `src/components/security/SessionGuard.tsx`, `src/lib/auth/IdleContext.tsx`
- **Yapılacaklar:**
  - Zamanlayıcı ref tabanlı olur (saniyelik re-render yok).
  - Kilitten 60 sn önce `ConfirmDialog` ile "Oturumunuz 60 sn içinde kapanacak — Devam et" uyarısı.
  - Sayfalar `useIdleExempt()` ile muafiyet ister (sınav, projektör).
  - Sekmeler arası etkinlik `BroadcastChannel` ile paylaşılır.
  - Bekleyen/askıdaki kullanıcı ekranları F3.5'e taşınır.
- **Doğrulama:** `tests/unit/SessionGuard.test.tsx` (sahte zamanlayıcı ile uyarı, muafiyet, kilit).

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
  - **PDF:** `pdfjs-dist` ile canvas'a sayfa sayfa çizim (worker `blob:`), üstte filigran katmanı (ad, e-posta, zaman damgası).
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
  - Admin protokol notu `calculators_config/{id}` dokümanına kaydedilir. Bu, admin-only kural ve `updatedBy`/`updatedAt` alanlarıyla doğrudan yazım veya callable ile yapılır.
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
- Functions parametreleri: `ENFORCE_APP_CHECK=true`, `REQUIRE_MFA=true`, `REQUIRE_EMAIL_VERIFIED=true`, `AUDIT_IP_SALT` secret.
- WebAuthn RP ID = hosting domaini.
- Deploy: `DEPLOY.md` sırası; ilk admin kurulumu; smoke test.

#### F10.3 UAT senaryoları (S)
`docs/revision/UAT_SCENARIOS.md`: gerçek hekimler ve eğitim sorumlusu için Türkçe adım adım senaryolar, beklenen sonuçlar ve hata bildirme şablonu.
- Kayıt ve onay
- MFA kurulumu
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
