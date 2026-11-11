import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";
import { ACCOUNTS, loginAs } from "./auth";

/** Sınav e2e yardımcıları (F5.2/F5.3): admin stüdyosu arayüzüyle taslak oluşturma ve yayın. */
export const SAMPLE_CSV = readFileSync(path.join(__dirname, "..", "..", "scripts", "fixtures", "quiz-ornek.csv"));

export async function openStudio(page: Page, tab?: "Yeni sınav" | "Görseller" | "Arşiv") {
  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/quizzes");
  await expect(page.getByRole("heading", { level: 1, name: "Sınav yönetimi" })).toBeVisible();
  if (tab) await page.getByRole("tab", { name: tab }).click();
}

export const quizRow = (page: Page, title: string) =>
  page.getByRole("table", { name: "Sınav listesi" }).getByRole("row").filter({ hasText: title });

export async function createDraft(
  page: Page,
  title: string,
  policy: "Sınav kapanınca (önerilen)" | "Teslimde hemen",
  durationMinutes = 15
) {
  await page.getByRole("tab", { name: "Yeni sınav" }).click();
  await page
    .getByLabel("Soru dosyası (CSV)")
    .setInputFiles({ name: "quiz-ornek.csv", mimeType: "text/csv", buffer: SAMPLE_CSV });
  await expect(page.getByText("quiz-ornek.csv: 3 soru")).toBeVisible();
  await page.getByLabel("Sınav başlığı").fill(title);
  await page.getByLabel("Süre (dakika)").fill(String(durationMinutes));
  await page.getByLabel(policy).check();
  await page.getByRole("button", { name: "Taslak olarak kaydet" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: `"${title}" taslak olarak kaydedildi (3 soru).` })
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Sınavlar" })).toHaveAttribute("aria-selected", "true");
  await expect(quizRow(page, title)).toContainText("Taslak");
}

export async function publish(page: Page, title: string) {
  await quizRow(page, title)
    .getByRole("button", { name: `${title}: yayınla` })
    .click();
  const dialog = page.getByRole("dialog", { name: "Sınavı yayınla" });
  await dialog.getByRole("button", { name: "Yayınla" }).click();
  return dialog;
}

/** Yayınlar; önceki sınavda süresi süren hekim varsa sunucunun istediği onayı da verir. */
export async function publishForce(page: Page, title: string) {
  const dialog = await publish(page, title);
  const force = dialog.getByRole("button", { name: "Yine de yayınla" });
  // Ya diyalog kapanır (yayınlandı) ya da sunucu onay ister ("Yine de yayınla").
  await expect(async () => {
    if (await force.isVisible()) await force.click();
    await expect(dialog).toHaveCount(0, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await expect(dialog).toHaveCount(0);
  await expect(quizRow(page, title)).toContainText("Yayında");
}

export const stat = (scope: Locator, label: string) =>
  scope
    .locator("dl > div")
    .filter({ has: scope.page().getByText(label, { exact: true }) })
    .locator("dd");
