import type { Browser, Page } from "@playwright/test";
import { parseNineFieldQuizCsv } from "../functions/src/shared/quizCsv";
import { loginAs } from "./fixtures/auth";
import { createDraft, openStudio, publishForce, quizRow, SAMPLE_CSV } from "./fixtures/quiz";
import { expect, expectNoHorizontalOverflow, guardedContext, test } from "./fixtures/test";

/**
 * F5.3: hekimin sınav ekranı gerçek callable'larla. Admin (ayrı bağlam) stüdyodan sınav yayınlar; hekim girer,
 * yanıtlar otomatik kaydedilir, sayfa yenilenince kaldığı yerden devam eder, teslim eder ve karneyi görür.
 * Doğru cevaplar istemciye yalnızca sunucu açtığında gelir (D7).
 */
const QUESTIONS = parseNineFieldQuizCsv(SAMPLE_CSV.toString("utf8")).questions;

async function adminPublishes(
  browser: Browser,
  title: string,
  policy: "Sınav kapanınca (önerilen)" | "Teslimde hemen"
) {
  const ctx = await guardedContext(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  const admin = await ctx.newPage();
  await openStudio(admin);
  await createDraft(admin, title, policy);
  await publishForce(admin, title);
  return { ctx, admin };
}

async function doctorPage(browser: Browser, email: string, viewport: { width: number; height: number } | null) {
  const ctx = await guardedContext(await browser.newContext(viewport ? { viewport } : {}));
  const page = await ctx.newPage();
  await loginAs(page, email);
  await page.goto("/quizzes");
  return { ctx, page };
}

const examHeading = (page: Page, n: number) => page.getByRole("heading", { name: `Soru ${n} / 3` });
const pill = (page: Page, n: number, answered: boolean) =>
  page
    .getByRole("navigation", { name: "Sorular" })
    .getByRole("button", { name: `Soru ${n}, ${answered ? "yanıtlandı" : "yanıtlanmadı"}` });

test("after_close: yanıtlar kaydedilir, yenilemede devam edilir, teslimde doğru cevaplar kapalı; kapanınca karne açılır (F5.3)", async ({
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  const title = `E2E sınav ekranı ${testInfo.project.name} ${Date.now()}`;
  const { ctx: adminCtx, admin } = await adminPublishes(browser, title, "Sınav kapanınca (önerilen)");
  const { ctx, page } = await doctorPage(browser, "asistan4@pediatrist.test", testInfo.project.use.viewport ?? null);

  const card = page.getByRole("region", { name: title });
  await expect(card).toContainText("Başlanmadı");
  await card.getByRole("button", { name: "Sınava başla" }).click();
  await expect(examHeading(page, 1)).toBeVisible();
  await expect(page.getByRole("timer", { name: "Kalan sınav süresi" })).toHaveText(/^1[45]:\d{2}$/);

  // Soru 1 (tek seçim) doğru; soru 3 (açık uçlu) doğru; soru 2 boş.
  await page.getByLabel(QUESTIONS[0].correctAnswers[0]).check();
  await pill(page, 3, false).click();
  await expect(examHeading(page, 3)).toBeFocused();
  await page.getByRole("textbox").fill("krup");
  // Son değişiklik ~3 sn sonra kaydedilir; durum satırı bekleyen değişikliği ve kaydı ayrı söyler.
  await expect(page.getByText("Değişiklikler birazdan kaydedilecek…")).toBeVisible();
  await expect(page.getByText(/Yanıtlar kaydedildi/)).toBeVisible({ timeout: 10_000 });
  // Klinik görsel gerçek <img>; büyütülebilir.
  await expect(page.getByRole("img", { name: "Soru 3 görseli" })).toBeVisible();
  await page.getByRole("button", { name: "Görseli büyüt" }).click();
  const zoom = page.getByRole("dialog", { name: "Soru 3 görseli" });
  await expect(zoom.getByRole("img", { name: "Soru 3 görseli" })).toBeVisible();
  await zoom.getByRole("button", { name: "Kapat" }).click();
  await expect(page.getByText("40 karakter", { exact: false })).toBeVisible();
  await expect(pill(page, 1, true)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // Yenileme: sınava kendiliğinden dönülür, yanıtlar sunucudan gelir.
  await page.reload();
  await expect(examHeading(page, 1)).toBeVisible();
  await expect(page.getByLabel(QUESTIONS[0].correctAnswers[0])).toBeChecked();
  await pill(page, 3, true).click();
  await expect(page.getByRole("textbox")).toHaveValue("krup");

  // Teslim: onay eksik soruyu söyler.
  await page.getByRole("button", { name: "Sınavı teslim et" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Sınavı teslim et" });
  await expect(confirm).toContainText("1 soru yanıtlanmadı.");
  await confirm.getByRole("button", { name: "Teslim et" }).click();

  const report = page.getByRole("region", { name: title });
  await expect(report.getByLabel("Puan 67 / 100")).toBeVisible();
  await expect(report).toContainText("2 / 3 doğru");
  await expect(page.getByRole("status").filter({ hasText: "Doğru cevaplar henüz kapalı" })).toBeVisible();
  await expect(report.getByText("Öğrenme noktası:")).toHaveCount(0);
  await expect(report.getByText("Doğru cevap:")).toHaveCount(0);
  await expect(page.getByText(QUESTIONS[0].feedbackText)).toHaveCount(0);

  // Admin kapatır → karne açılır (bu sınavda süresi süren başka hekim yok: revealAt = kapanış anı).
  await admin.getByRole("region", { name: title }).getByRole("button", { name: "Sınavı kapat" }).click();
  await admin.getByRole("alertdialog", { name: "Sınavı kapat" }).getByRole("button", { name: "Sınavı kapat" }).click();
  await expect(quizRow(admin, title)).toContainText("Kapalı");

  await page.getByRole("button", { name: "Sınavlarıma dön" }).click();
  const results = page.getByRole("table", { name: "Sınav sonuçlarım" });
  await results
    .getByRole("row")
    .filter({ hasText: title })
    .getByRole("button", { name: `${title}: karne` })
    .click();
  await expect(page.getByText(QUESTIONS[0].feedbackText)).toBeVisible();
  await expect(page.getByText("Doğru cevap:").first()).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Doğru cevaplar henüz kapalı" })).toHaveCount(0);

  await ctx.close();
  await adminCtx.close();
});

test("immediate: sınavdan ayrılıp dönülür; teslimde tam karne hemen görünür (F5.3)", async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const title = `E2E anında karne ${testInfo.project.name} ${Date.now()}`;
  const { ctx: adminCtx } = await adminPublishes(browser, title, "Teslimde hemen");
  const { ctx, page } = await doctorPage(browser, "asistan1@pediatrist.test", testInfo.project.use.viewport ?? null);

  await page.getByRole("region", { name: title }).getByRole("button", { name: "Sınava başla" }).click();
  await page.getByLabel(QUESTIONS[0].correctAnswers[0]).check();

  // Ayrıl: süre durmaz uyarısı; yanıt kaydedilir; panelden devam edilir.
  await page.getByRole("button", { name: "Sınavdan ayrıl" }).click();
  const leave = page.getByRole("alertdialog", { name: "Sınavdan ayrıl" });
  await expect(leave).toContainText("Süreniz DURMAZ");
  await leave.getByRole("button", { name: "Kaydet ve ayrıl" }).click();
  const card = page.getByRole("region", { name: title });
  await expect(card).toContainText("Devam ediyor");
  await card.getByRole("button", { name: "Sınava devam et" }).click();
  await expect(page.getByLabel(QUESTIONS[0].correctAnswers[0])).toBeChecked();

  // Hepsini doğru yanıtla ve teslim et.
  await page.getByRole("button", { name: "Sonraki" }).click();
  for (const answer of QUESTIONS[1].correctAnswers) await page.getByLabel(answer).check();
  await page.getByRole("button", { name: "Sonraki" }).click();
  await page.getByRole("textbox").fill(QUESTIONS[2].correctAnswers[0]);
  await page.getByRole("button", { name: "Sınavı teslim et" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Sınavı teslim et" });
  await expect(confirm).toContainText("Bütün sorular yanıtlandı.");
  await confirm.getByRole("button", { name: "Teslim et" }).click();

  const report = page.getByRole("region", { name: title });
  await expect(report.getByLabel("Puan 100 / 100")).toBeVisible();
  await expect(page.getByText(QUESTIONS[0].feedbackText)).toBeVisible();
  await expect(report.getByText("Yanlış", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await ctx.close();
  await adminCtx.close();
});
