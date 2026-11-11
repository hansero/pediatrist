# Emülatör Test Verisi

Bu klasördeki her şey **yalnızca yerel Firebase emülatörleri** (`demo-pediatrist` projesi) içindir.
Uygulama kodu (`src/`, `functions/src/`) bu klasörden hiçbir şey import etmez (REVISION_PLAN D1).

## Kullanım

```bash
npm run emulators   # ayrı terminalde açık kalsın
npm run seed        # emülatör verisini SİLER ve yeniden yükler
npm run dev         # http://localhost:3000 (emülatöre bağlı)
```

`npm run seed -- --no-reset` mevcut veriyi silmeden ekler (çakışan kullanıcılar hata verir).

Güvenlik: Seed script'i yalnızca `127.0.0.1`/`localhost` emülatör adreslerine ve `demo-` önekli projeye yazar.
Aksi durumda çalışmayı reddeder.

## Test hesapları

Ortak şifre: **`Pediatrist-Test-2026!`** (bütün e-postalar doğrulanmış)

| E-posta | Rol | Durum | Kıdem |
|---|---|---|---|
| `egitim.sorumlusu@pediatrist.test` | admin | active | — |
| `asistan1@pediatrist.test` | user | active | 1 |
| `asistan2@pediatrist.test` | user | active | 2 |
| `asistan3@pediatrist.test` | user | active | 3 |
| `asistan4@pediatrist.test` | user | active | 4 |
| `bekleyen@pediatrist.test` | user | pending | 1 |
| `askida@pediatrist.test` | user | suspended | 2 |

Davet: kod `DAVET-TEST-001`, e-posta `davetli@pediatrist.test` (hesap yok; kayıt akışını test etmek için).

## Yüklenen içerik

| Veri | Ayrıntı |
|---|---|
| Materyaller | 2 PDF (`files/*.pdf`) Storage'a `materials/{id}/` altında + `materials/{id}` dokümanları |
| Sınav görseli | `quiz_media/steeple_sign.png` (CSV fixture'ı buna başvurur) |
| Yoklama | 1 kapanmış ders: asistan 1–2 katıldı, asistan 3 mazeretli, asistan 4 katılmadı |
| Sınavlar | **Gerçek callable'larla** (Functions emülatörü gerekir): `quiz-ornek.csv` taslak → yayın; asistan 1/2/3 teslim (puan 100/67/33, sunucuda puanlanır); sınav kapatıldı (`after_close`, karne açık). Ayrıca 1 taslak sınav (1 soru) |

## Dosyalar

- `seed-data.ts`: seed içeriği (kişiler kurgusaldır, `.test` alan adı gerçek olamaz).
- `files/`: küçük, gerçek PDF ve PNG dosyaları. Klinik kullanım için değildir.
- `quiz-ornek.csv`: 9 sütunlu örnek sınav (3 soru). `npx tsx scripts/fixtures/build-quiz-csv.ts` ile
  yeniden üretilir; üretim sırasında gerçek ayrıştırıcıdan 0 hatayla geçmesi zorunludur.
