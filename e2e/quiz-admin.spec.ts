import { readFileSync } from "node:fs";
import path from "node:path";
import { findDocIds, writeDocument } from "./fixtures/emulator";
import { createDraft, openStudio, publish, quizRow, SAMPLE_CSV, stat } from "./fixtures/quiz";
import { expect, expectNoHorizontalOverflow, test } from "./fixtures/test";

/**
 * F5.2: admin sınav stüdyosu, gerçek callable'lar ve Storage ile. Seed: 1 kapanmış sınav (3 girişim) + 1 taslak.
 * Her test kendi benzersiz başlıklı sınavlarını oluşturur (iki ekran boyutu aynı emülatör verisinde koşar).
 */
const FIXTURES = path.join(__dirname, "..", "scripts", "fixtures");
const PNG = readFileSync(path.join(FIXTURES, "files", "steeple_sign.png"));

test("stüdyo: seed sınavları listelenir; görsel yükleme, CSV hataları ve eksik görsel engeli (F5.2)", async ({
  page,
}, testInfo) => {
  await openStudio(page);
  await expect(quizRow(page, "Pediatrik Acil Vakalar: Örnek Sınav")).toContainText("Kapalı");
  await expect(quizRow(page, "Pediatrik Acil Vakalar: Örnek Sınav")).toContainText("3");
  await expect(quizRow(page, "Taslak: Kawasaki Hastalığı Tekrar")).toContainText("Taslak");
  await page
    .getByRole("group", { name: "Duruma göre süz" })
    .getByRole("button", { name: /^Taslak/ })
    .click();
  await expect(quizRow(page, "Pediatrik Acil Vakalar: Örnek Sınav")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  // Görsel: yüklenir, listede görünür; aynı ad ikinci kez yüklenemez (üzerine yazma yok).
  await page.getByRole("tab", { name: "Görseller" }).click();
  const name = `e2e-${testInfo.project.name}-${Date.now()}.png`;
  const mediaPath = `quiz_media/${name.replace(".png", "")}.png`;
  await page.getByLabel("Görsel dosyaları").setInputFiles({ name, mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "1 görseli yükle" }).click();
  await expect(page.getByRole("status").filter({ hasText: "1 görsel yüklendi." })).toBeVisible();
  const uploaded = page
    .getByRole("table", { name: "Yüklü sınav görselleri" })
    .getByRole("row")
    .filter({ hasText: mediaPath });
  await expect(uploaded).toBeVisible();
  // Küçük önizleme süs görselidir (alt=""), gerçek Storage URL'sinden yüklenir.
  await expect(uploaded.locator("img")).toHaveJSProperty("complete", true);
  await page.getByLabel("Görsel dosyaları").setInputFiles({ name, mimeType: "image/png", buffer: PNG });
  await expect(page.getByText(`Bu adla bir görsel zaten var (${mediaPath})`)).toBeVisible();
  await page
    .getByLabel("Görsel dosyaları")
    .setInputFiles({ name: "x.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
  await expect(page.getByText("Yalnızca PNG, JPEG, WebP veya GIF görsel yüklenebilir.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Yükle", exact: true })).toBeDisabled();

  // CSV: satır numaralı hata, kaydetme kapalı.
  await page.getByRole("tab", { name: "Yeni sınav" }).click();
  const broken = SAMPLE_CSV.toString("utf8").replace('"Single Choice"', '"Tek Seçim"');
  await page
    .getByLabel("Soru dosyası (CSV)")
    .setInputFiles({ name: "bozuk.csv", mimeType: "text/csv", buffer: Buffer.from(broken) });
  await expect(
    page.getByRole("table", { name: "CSV hataları" }).getByRole("row").filter({ hasText: "4: Soru Tipi" })
  ).toContainText("2");
  await expect(page.getByRole("button", { name: "Taslak olarak kaydet" })).toBeDisabled();

  // Eksik görsel: sunucuya gitmeden satır numarasıyla engellenir.
  const missing = SAMPLE_CSV.toString("utf8").replace("quiz_media/steeple_sign.png", "quiz_media/olmayan-gorsel.png");
  await page
    .getByLabel("Soru dosyası (CSV)")
    .setInputFiles({ name: "eksik.csv", mimeType: "text/csv", buffer: Buffer.from(missing) });
  await expect(page.getByRole("alert").filter({ hasText: "quiz_media/olmayan-gorsel.png" })).toContainText("Satır 4");
  await expect(page.getByRole("button", { name: "Taslak olarak kaydet" })).toBeDisabled();

  // Geçerli CSV: önizlemede görsel gerçek <img>; cevap anahtarı varsayılan kapalı.
  await page
    .getByLabel("Soru dosyası (CSV)")
    .setInputFiles({ name: "quiz-ornek.csv", mimeType: "text/csv", buffer: SAMPLE_CSV });
  const preview = page.getByRole("region", { name: "Soru önizlemesi" });
  await expect(preview.getByRole("img", { name: "Soru 3 görseli" })).toBeVisible();
  await expect(preview.getByText("Öğrenme noktası:")).toHaveCount(0);
  await page.getByLabel("Cevap anahtarını göster").check();
  await expect(preview.getByText("Öğrenme noktası:").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("taslak → düzenle → yayınla → sınavda hekim varken yeni yayın onayı → kapat → arşiv CSV (F5.2)", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const stamp = `${testInfo.project.name} ${Date.now()}`;
  const first = `E2E ilk sınav ${stamp}`;
  const second = `E2E ikinci sınav ${stamp}`;
  await openStudio(page);
  await createDraft(page, first, "Sınav kapanınca (önerilen)");

  // Düzenle: başlık değişir (sunucuda).
  await quizRow(page, first)
    .getByRole("button", { name: `${first}: düzenle` })
    .click();
  const edit = page.getByRole("dialog", { name: "Taslağı düzenle" });
  await expect(edit.getByLabel("Sınav başlığı")).toHaveValue(first);
  const renamed = `${first} (güncel)`;
  await edit.getByLabel("Sınav başlığı").fill(renamed);
  await edit.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Taslak güncellendi (3 soru)." })).toBeVisible();
  await expect(quizRow(page, renamed)).toBeVisible();

  // Yayınla.
  const dialog = await publish(page, renamed);
  await expect(dialog).toHaveCount(0);
  await expect(quizRow(page, renamed)).toContainText("Yayında");
  const live = page.getByRole("region", { name: renamed });
  await expect(stat(live, "Katılım")).toHaveText("0");

  // Bir hekim sınavda (test hazırlığı: süresi devam eden girişim).
  const [quizId] = await findDocIds("quizzes", "title", renamed);
  // Hazırlık verisi giriş yapamayan (onay bekleyen) bir üyeye yazılır: başka testlerin hekimlerini etkilemesin.
  await writeDocument(`quiz_attempts/${quizId}_seed-bekleyen`, {
    quizId,
    quizTitle: renamed,
    uid: "seed-bekleyen",
    status: "in_progress",
    deadline: new Date(Date.now() + 10 * 60_000),
  });

  // İkinci sınav yayınlanırken sunucu onay ister; "Yine de yayınla" ile ilk sınav kapanır.
  await createDraft(page, second, "Teslimde hemen");
  const second$ = await publish(page, second);
  await expect(second$.getByText("1 hekim hâlâ sınavda")).toBeVisible();
  await expect(quizRow(page, renamed)).toContainText("Yayında");
  await second$.getByRole("button", { name: "Yine de yayınla" }).click();
  await expect(second$).toHaveCount(0);
  await expect(quizRow(page, second)).toContainText("Yayında");
  await expect(quizRow(page, renamed)).toContainText("Kapalı");

  // Kapat (onaylı).
  await page.getByRole("region", { name: second }).getByRole("button", { name: "Sınavı kapat" }).click();
  await page.getByRole("alertdialog", { name: "Sınavı kapat" }).getByRole("button", { name: "Sınavı kapat" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sınav kapatıldı." })).toBeVisible();
  await expect(quizRow(page, second)).toContainText("Kapalı");

  // Arşiv: kapanan sınavın soruları; dışa aktarılan CSV içe aktarma biçiminde.
  await page.getByRole("tab", { name: "Arşiv" }).click();
  await page.getByLabel("Ara", { exact: true }).fill(renamed);
  const archive = page.getByRole("table", { name: "Arşivlenmiş sorular" });
  await expect(archive.getByRole("row").filter({ hasText: renamed })).toHaveCount(3);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Listelenen arşiv sorularını CSV olarak indir" }).click(),
  ]);
  const lines = readFileSync((await download.path())!, "utf8")
    .replace(/^﻿/, "")
    .trimEnd()
    .split("\r\n");
  expect(lines[0]).toBe(
    "Soru İçeriği;Soru Görseli;Sorunun Kendi;Soru Tipi;Maximum Length;Seçenekler;Seçenekler (JSON);Doğru Seçenek (JSON);Feedback_Text;Kaynak sınav;Arşivlenme"
  );
  expect(lines.filter((l) => l.includes(renamed))).toHaveLength(3);
  await expectNoHorizontalOverflow(page);
});

test("taslak silme onay ister ve sunucuda silinir (F5.2)", async ({ page }, testInfo) => {
  const title = `E2E silinecek ${testInfo.project.name} ${Date.now()}`;
  await openStudio(page);
  await createDraft(page, title, "Sınav kapanınca (önerilen)");
  await quizRow(page, title)
    .getByRole("button", { name: `${title}: sil` })
    .click();
  const confirm = page.getByRole("alertdialog", { name: "Taslağı sil" });
  await expect(confirm.getByRole("button", { name: "Vazgeç" })).toBeFocused();
  await confirm.getByRole("button", { name: "Taslağı sil" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Taslak silindi." })).toBeVisible();
  await expect(quizRow(page, title)).toHaveCount(0);
  expect(await findDocIds("quizzes", "title", title)).toEqual([]);
});
