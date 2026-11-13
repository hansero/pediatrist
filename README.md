# Pediatrist

Pediatri eğitim kliniği için kapalı devre eğitim platformu: ders yoklaması, çevrimiçi vaka sınavları, eğitim
materyalleri ve üyelik yönetimi. Arayüz dili Türkçedir.

- **İstemci:** Next.js 15 (App Router), React 19, TypeScript
- **Sunucu:** Firebase — Authentication (Identity Platform, TOTP), Firestore, Cloud Storage, Cloud Functions v2
  (`europe-west1`), App Check
- **Durum:** Bütün modüller gerçek veriyle çalışır ve emülatörde uçtan uca test edilir. **Gerçek bir Firebase
  projesine henüz dağıtılmamıştır**; dağıtım adımları için [`DEPLOY.md`](DEPLOY.md), yapılan iş ve kalan adımlar
  için [`docs/revision/REVISION_PLAN.md`](docs/revision/REVISION_PLAN.md).

## Modüller

| Sayfa | Eğitim sorumlusu (admin) | Hekim |
|---|---|---|
| `/dashboard` | Sıradaki iş (süren ders, bekleyen başvuru, yayındaki sınav) ve klinik göstergeleri | Sıradaki iş (yoklama, sınav, zorunlu materyal) ve kişisel göstergeler |
| `/attendance` | Ders başlatma, projektör ekranı (15 sn'de değişen kod + QR), canlı liste, mazeret, raporlar ve CSV | QR okutarak ya da projektördeki kodu girerek katılım (yalnızca 1.–4. yıl asistanlar; uzman ve öğretim üyeleri yoklamaya tabi değil); kişisel geçmiş |
| `/quizzes` | CSV ile sınav hazırlama, önizleme, yayınlama/kapatma, görsel yükleme, sonuç analitiği, soru arşivi | Süreli sınav (yanıtlar sunucuya kaydedilir), karne, gelişim grafiği |
| `/materials` | PDF / video / görsel yükleme, hedef kıdem, zorunlu okuma, okunma raporu | Filigranlı görüntüleme, ilerleme takibi, izin varsa indirme |
| `/calculators` | Planlanan hesaplayıcılar için klinik protokol notu | Planlanan hesaplayıcılar ve protokol notları (**hesaplama henüz yok**) |
| `/admin` | Üye onayı, rol ve durum, iki aşamalı doğrulama sıfırlama, üye silme, veri dökümü, davetler, denetim kayıtları | — |
| `/account/*` | İki aşamalı doğrulama, kişisel veri dökümü | Aynı |

## Yerel kurulum

Gerekenler: Node.js 22, Java 21 (Firebase emülatörleri için). Gerçek bir Firebase projesi **gerekmez**: yerel
geliştirme ve bütün testler `demo-pediatrist` kimlikli emülatör projesiyle çalışır ve gerçek bir projeye
bağlanamaz.

```bash
npm ci && npm --prefix functions ci
```

Üç ayrı terminalde:

```bash
npm run emulators
```

```bash
npm run seed
```

```bash
npm run dev
```

Uygulama `http://localhost:3000` adresinde açılır. `npm run seed` emülatördeki veriyi **siler** ve test verisini
yeniden yükler; yalnızca emülatöre yazar, başka bir adreste çalışmayı reddeder.

Test hesapları (yalnızca emülatörde vardır; tam liste ve ortak şifre `scripts/fixtures/seed-data.ts` içinde):

| Hesap | Rol |
|---|---|
| `egitim.sorumlusu@pediatrist.test` | Eğitim sorumlusu |
| `asistan1@…` – `asistan4@pediatrist.test` | Hekim (1.–4. yıl) |
| `bekleyen@pediatrist.test` | Onay bekleyen başvuru |
| `askida@pediatrist.test` | Askıya alınmış üye |

Emülatörün kısıtları: Authentication emülatörü TOTP kaydını desteklemez, bu yüzden test verisi iki aşamalı
doğrulama zorunluluğunu kapatır (gerçek projede zorunludur). Emülatör istemci IP'sini iletmediği için denetim
kayıtlarında ağ özeti yerelde boş kalır.

## Doğrulama komutları

```bash
npm run lint && npm run typecheck && npm run format:check
```

```bash
npm run check:no-mock
```

```bash
npm run test:unit
```

```bash
npm run test:rules
```

```bash
npm run test:functions
```

```bash
npm run test:e2e
```

```bash
npm run build && npm --prefix functions run build
```

- `test:rules`, `test:functions` ve `test:e2e` gereken emülatörleri kendileri başlatır; `npm run emulators`
  açıkken çalıştırmayın (port çakışır).
- `test:e2e` üretim derlemesine karşı, masaüstü ve telefon ekran boyutlarında koşar; erişilebilirlik denetimi
  (axe) ve içerik güvenlik politikası (CSP) bekçisi dahildir. Playwright'ın Chromium'u kurulu olmalıdır.
- CI (`.github/workflows/ci.yml`) aynı komutları her push'ta çalıştırır.

## Mimari

```
src/                      Next.js istemcisi
  app/                    Sayfalar: (auth) giriş/kayıt, (protected) modüller, (public) KVKK metni
  components/             Modül bileşenleri ve ortak arayüz primitifleri (components/ui)
  lib/                    Firestore okuma kancaları, callable bağları, oturum, hata eşleme
functions/src/            Cloud Functions (bütün yazma işlemleri)
  shared/                 İstemci ile sunucunun ORTAK sözleşmeleri (zod şemaları, sabitler, tipler)
  guards.ts               Yetki denetimlerinin tek yeri
  auditLogger.ts          Denetim kayıtları (ana işlemle aynı batch / transaction içinde)
firestore.rules           Okuma yetkileri; istemci yazımı neredeyse tümüyle kapalı
storage.rules             Dosya okuma/yazma yetkileri ve tür/boyut sınırları
scripts/seed-emulator.ts  Yalnızca emülatöre yazılan test verisi
e2e/, tests/, functions/test/   Uçtan uca, birim/kural ve functions testleri
```

Temel ilkeler (ayrıntısı [`CLAUDE.md`](CLAUDE.md) ve `REVISION_PLAN.md` §3 karar kayıtlarında):

1. **Sahte veri yok.** `src/` ve `functions/src/` içinde mock, seed veya istemcide üretilmiş "başarılı" yanıt
   bulunmaz; `npm run check:no-mock` bunu istisnasız denetler.
2. **Yazma işlemleri sunucudadır.** İstemci sonucu bekler ve hatayı gösterir; iyimser "başarılı" bildirimi yoktur.
3. **Yetkinin tek kaynağı `users/{uid}` dokümanıdır.** Token içindeki roller yalnızca önbellektir; askıya alma
   ve yetki düşürme anında etkili olur.
4. **Sözleşmeler tek yerdedir.** İstek/yanıt şemaları ve sabitler `functions/src/shared/` içindedir; istemci
   `@shared/*` ile aynı dosyaları kullanır.
5. **Doğru cevaplar istemciye gitmez.** Sınav soruları yalnızca girişimle birlikte, cevap anahtarı olmadan
   gelir; puanlama sunucudadır; açıklamalar sınavın gösterim kuralına göre açılır.

## Bilinen sınırlar

- Hesaplayıcılarda formül motoru yoktur (bilinçli karar: klinik doğrulama gerektirir).
- KVKK aydınlatma metni kurumun hukuk birimince onaylanana kadar "taslak" olarak işaretlidir.
- Dağıtım, alarm, yedekleme ve otomatik silme (TTL) adımları gerçek bir projede henüz denenmemiştir.
- Sunucu tarafı sayfa koruması (oturum çerezi) yoktur; veriler kurallar ve Cloud Functions ile korunur.
