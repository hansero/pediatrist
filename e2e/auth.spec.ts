import { ACCOUNTS, loginAs } from "./fixtures/auth";
import { listOobCodes } from "./fixtures/emulator";
import { openMenu } from "./fixtures/nav";
import { expect, test } from "./fixtures/test";

/**
 * F3.4: gerçek giriş. Sahte TOTP adımı yok; yanlış şifre Türkçe hata verir; şifre sıfırlama e-postası
 * Auth emülatörüne gerçekten düşer. (TOTP akışı: birim testleri + staging, D5.)
 */
test("doğru şifre: doğrudan panel; sahte 6 hane adımı yok", async ({ page }) => {
  await loginAs(page, ACCOUNTS.asistan2);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("6 Haneli Doğrulama Kodu")).toHaveCount(0);
});

test("yanlış şifre: Türkçe hata, giriş sayfasında kalır", async ({ page }) => {
  await loginAs(page, ACCOUNTS.asistan2, "Yanlis-Sifre-123", { expectSuccess: false });
  await expect(page.getByRole("alert").filter({ hasText: "E-posta adresi veya şifre hatalı." })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("şifremi unuttum: bağlantı e-postası Auth emülatörüne düşer; kayıtsız adres için aynı nötr mesaj", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Şifremi unuttum" }).click();
  await expect(page).toHaveURL(/\/reset$/);

  const send = page.getByRole("button", { name: "Sıfırlama bağlantısı gönder" });
  await expect(send).toBeEnabled();
  await page.getByLabel("E-posta").fill(ACCOUNTS.asistan2);
  await send.click();
  await expect(page.getByRole("status").filter({ hasText: "şifre sıfırlama bağlantısı gönderildi" })).toBeVisible();
  await expect
    .poll(async () =>
      (await listOobCodes()).some((c) => c.email === ACCOUNTS.asistan2 && c.requestType === "PASSWORD_RESET")
    )
    .toBe(true);

  await page.reload();
  await expect(send).toBeEnabled();
  await page.getByLabel("E-posta").fill(`kayitsiz.${Date.now()}@pediatrist.test`);
  await send.click();
  await expect(page.getByRole("status").filter({ hasText: "Bu adres kayıtlıysa" })).toBeVisible();
});

test("hesap güvenliği sayfası: menüden ulaşılır, iki aşamalı doğrulama durumu gösterilir", async ({ page }) => {
  await loginAs(page, ACCOUNTS.asistan2);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const menu = await openMenu(page);
  await menu.getByRole("link", { name: "Hesap güvenliği" }).click();
  await expect(page.getByRole("heading", { name: "Hesap güvenliği", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "İki aşamalı doğrulama" })).toContainText("Kapalı");
  // Emülatör TOTP kaydını desteklemez: düğme yerine açıklama (gerçek kurulum staging'de, F10.3).
  await expect(page.getByRole("status").filter({ hasText: "emülatöründe desteklenmiyor" })).toBeVisible();
});
