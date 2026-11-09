# Pediatrist — Claude Çalışma Kuralları

Pediatri eğitim kliniği platformu: Next.js 15 (App Router), Firebase (Auth, Firestore, Storage, Cloud Functions v2, `europe-west1`). UI dili Türkçe.

## Devam eden iş: Revizyon programı

**Her oturumun başında ilk iş:** `docs/revision/REVISION_PLAN.md` dosyasını aç ve **§0 Devam Protokolü**'nü uygula. Sıradaki adım, §1 İlerleme Tablosu ve §2 Son Oturum Devir Notu'nda yazar. Kullanıcıdan yeniden plan isteme; plan hazır.

- Denetim bulguları: `docs/revision/AUDIT.md` (C1..C11, S1..S15)
- Branch: `feat/pediatrist-platform`. Her adımdan sonra commit (`rev(Fx.y): …`) ve push yapılır.
- Adım bittiğinde: tabloyu güncelle, Devir Notu'nu yeniden yaz, commit et, push'la. Limit yaklaşırsa WIP commit'i + Devir Notu.

## Değişmez kurallar

1. `src/` ve `functions/src/` içinde **mock, seed, uydurma veri, sahte isim ve istemcide üretilmiş "başarılı" yanıt yasak**. Test verisi yalnızca `scripts/seed-emulator.ts` içinde bulunur ve yalnızca emülatöre yazılır. `npm run check:no-mock` yeşil olmalı.
2. Sunucu mutasyonları `await` edilir ve hatalar kullanıcıya gösterilir. İyimser "başarılı" UI kullanılmaz.
3. Yetkinin tek kaynağı `users/{uid}` dokümanıdır. Functions'ta yetki kontrolü yalnızca `functions/src/guards.ts` üzerinden yapılır.
4. İstemci ile sunucu arasındaki sözleşmeler (zod şemaları, sabitler, tipler) `functions/src/shared/` içindedir; Next tarafı `@shared/*` ile import eder. Aynı sabiti iki yerde tanımlama.
5. Doğru cevaplar ve feedback metni istemci paketine asla girmez. Puanlama yalnızca sunucuda yapılır.
6. Kalıcı kararlar `REVISION_PLAN.md` §3 D-kayıtlarındadır. Bunlarla çelişen bir şey yapmadan önce kullanıcıya sor.

## Komutlar (F0 tamamlandıktan sonra geçerli)

```bash
npm ci && npm --prefix functions ci
npm run emulators          # auth, firestore, storage, functions
npm run seed               # yalnızca emülatöre test verisi
npm run dev                # NEXT_PUBLIC_USE_EMULATORS=true ile
npm run lint && npm run typecheck
npm run test:unit && npm run test:rules && npm run test:functions && npm run test:e2e
npm run check:no-mock
npm run build && npm --prefix functions run build
```

Playwright: ortamda önceden kurulu Chromium kullanılır, `playwright install` çalıştırma (gerekirse `executablePath: '/opt/pw-browsers/chromium'`).
