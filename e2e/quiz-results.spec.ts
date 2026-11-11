import { readFileSync } from "node:fs";
import type { Locator, Page } from "@playwright/test";
import { loginAs } from "./fixtures/auth";
import { createDraft, openStudio, publishForce } from "./fixtures/quiz";
import { expect, expectNoHorizontalOverflow, guardedContext, test } from "./fixtures/test";

/**
 * F5.4: sınav sonuçları ve gelişim. Seed sınavı (kapalı): asistan 1/2/3 → 100/67/33 (sunucuda puanlandı).
 * Soru bazında: S1 3/3, S2 1/3, S3 2/3.
 */
const SEED_QUIZ = "Pediatrik Acil Vakalar: Örnek Sınav";

const stat = (scope: Locator, label: string) =>
  scope
    .locator("dl > div")
    .filter({ has: scope.page().getByText(label, { exact: true }) })
    .locator("dd");

async function openResults(page: Page) {
  await openStudio(page);
  await page.getByRole("tab", { name: "Sonuçlar" }).click();
  await page.getByLabel("Sınav", { exact: true }).selectOption({ label: `${SEED_QUIZ} (kapalı)` });
}

test("admin sonuçları: özet, soru bazında oran, süzme, karne ve CSV (F5.4)", async ({ page }) => {
  await openResults(page);
  const summary = page.getByRole("region", { name: "Sınav sonuçları" });
  await expect(stat(summary, "Teslim")).toHaveText("3");
  await expect(stat(summary, "Ortalama")).toHaveText("67");
  await expect(stat(summary, "Medyan")).toHaveText("67");

  const meters = page.getByRole("list", { name: "Soru bazında doğru oranı" });
  await expect(meters.getByRole("listitem").nth(0)).toContainText("(3/3)");
  await expect(meters.getByRole("listitem").nth(1)).toContainText("(1/3)");
  await expect(meters.getByRole("listitem").nth(2)).toContainText("(2/3)");

  const table = page.getByRole("table", { name: "Sınav teslimleri" });
  await expect(table.getByRole("row")).toHaveCount(4); // başlık + 3
  await page.getByLabel("Kıdem").selectOption("1");
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table).toContainText("Kerem Yalçın");
  await expect(stat(summary, "Teslim")).toHaveText("1");
  await page.getByLabel("Kıdem").selectOption("all");
  await expectNoHorizontalOverflow(page);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Sınav sonuçlarını CSV olarak indir" }).click(),
  ]);
  const lines = readFileSync((await download.path())!, "utf8")
    .replace(/^﻿/, "")
    .trimEnd()
    .split("\r\n");
  expect(lines[0]).toBe("Sınav;Hekim;Kıdem;Puan;Doğru;Soru;Teslim;Teslim türü;Süre (dk);Sekme değişimi");
  expect(lines).toHaveLength(4);
  expect(lines.find((l) => l.includes("Emre Koç"))).toMatch(/;3\. yıl;33;1;3;.*;Zamanında;/);

  // Admin her zaman tam karneyi görür (getAttemptReport).
  await table.getByRole("button", { name: "Asistan Dr. Emre Koç: karne" }).click();
  await expect(page.getByLabel("Puan 33 / 100")).toBeVisible();
  await expect(page.getByText("Öğrenme noktası:").first()).toBeVisible();
  await page.getByRole("button", { name: "Sonuçlara dön" }).click();
  await expect(table).toBeVisible();
});

test("gelişim: hekim ikinci sınavını teslim eder → kendi grafiği; admin hekim kimliğine göre gelişimi görür (F5.4)", async ({
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  const title = `E2E gelişim ${testInfo.project.name} ${Date.now()}`;
  const adminCtx = await guardedContext(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  const admin = await adminCtx.newPage();
  await openStudio(admin);
  await createDraft(admin, title, "Teslimde hemen");
  await publishForce(admin, title);

  // asistan2 (seed: 67) yeni sınava girip boş teslim eder (0) → en az iki teslim.
  const ctx = await guardedContext(await browser.newContext({ viewport: testInfo.project.use.viewport ?? undefined }));
  const doctor = await ctx.newPage();
  await loginAs(doctor, "asistan2@pediatrist.test");
  await doctor.goto("/quizzes");
  await doctor.getByRole("region", { name: title }).getByRole("button", { name: "Sınava başla" }).click();
  await doctor.getByRole("button", { name: "Sınavı teslim et" }).first().click();
  const confirm = doctor.getByRole("alertdialog", { name: "Sınavı teslim et" });
  await expect(confirm).toContainText("3 soru yanıtlanmadı.");
  await confirm.getByRole("button", { name: "Teslim et" }).click();
  await expect(doctor.getByLabel("Puan 0 / 100")).toBeVisible();
  await doctor.getByRole("button", { name: "Sınavlarıma dön" }).click();

  const progress = doctor.getByRole("region", { name: "Gelişimim" });
  await expect(stat(progress, "Son puan")).toHaveText("0");
  await expect(stat(progress, "En yüksek")).toHaveText("67");
  const chart = progress.getByRole("img", { name: /^Puan gelişimim: \d+ sınav, ilk 67, son 0 puan\.$/ });
  await expect(chart).toBeVisible();
  // Klavye: grafik odaklanınca ←/→/End noktalar arasında gezer ve duyurulur.
  await chart.focus();
  await doctor.keyboard.press("End");
  await expect(progress.getByText(`${title}`, { exact: false }).last()).toBeAttached();
  await expect(progress.locator("[aria-live=polite]")).toContainText("0 puan");
  await expectNoHorizontalOverflow(doctor);

  // Admin: Hekimler sekmesi, kimliğe göre gruplanmış satır ve gelişim grafiği.
  await admin.getByRole("tab", { name: "Hekimler" }).click();
  const doctors = admin.getByRole("table", { name: "Hekim gelişimi" });
  await doctors.getByRole("button", { name: "Asistan Dr. Selin Ateş: gelişim" }).click();
  const detail = admin.getByRole("region", { name: "Asistan Dr. Selin Ateş: puan gelişimi" });
  await expect(detail.getByRole("img", { name: /Selin Ateş puan gelişimi: \d+ sınav/ })).toBeVisible();
  await detail.getByRole("button", { name: `${title}: karne` }).click();
  await expect(admin.getByLabel("Puan 0 / 100")).toBeVisible();

  await ctx.close();
  await adminCtx.close();
});
