import { ACCOUNTS, loginAs } from "./fixtures/auth";
import { expect, test } from "./fixtures/test";

/**
 * F3.3 (AUDIT C8): hareketsizlik uyarısı ve gerçek çıkış. Tarayıcı saati Playwright ile ileri sarılır.
 */
test("14. dakikada uyarı; 'Devam et' süreyi yeniler; 15 dk sonra nedenli çıkış", async ({ page }) => {
  await page.clock.install();
  await loginAs(page, ACCOUNTS.asistan2);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.clock.fastForward("14:01");
  const dialog = page.getByRole("alertdialog", { name: "Oturumunuz kapanmak üzere" });
  await expect(dialog).toBeVisible();
  const keep = dialog.getByRole("button", { name: "Devam et" });
  await expect(keep).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);

  await page.clock.fastForward("14:01");
  await expect(dialog).toBeVisible();
  await page.clock.fastForward("01:01");

  await expect(page).toHaveURL(/\/login\?neden=hareketsizlik$/);
  await expect(page.getByRole("status").filter({ hasText: "işlem yapılmadığı için" })).toBeVisible();
});
