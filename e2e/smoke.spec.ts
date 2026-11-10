import { expect, test } from "./fixtures/test";
import { ACCOUNTS, loginAs } from "./fixtures/auth";
import { openMenu } from "./fixtures/nav";

/**
 * Duman testi: seed hesaplarıyla rol bazlı giriş. Gerçek emülatör verisi kullanılır
 * (seed, `npm run test:e2e` tarafından testlerden önce yüklenir).
 */
test.describe("rol bazlı giriş", () => {
  test("eğitim sorumlusu panele girer ve yönetim menüsünü görür", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));

    await loginAs(page, ACCOUNTS.admin);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Nevin Aydoğan");
    const menu = await openMenu(page);
    await expect(menu.getByRole("link", { name: "Üyeler ve Güvenlik" })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("asistan panele girer, yönetim menüsünü görmez", async ({ page }) => {
    await loginAs(page, ACCOUNTS.asistan2);

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Selin Ateş");
    const menu = await openMenu(page);
    await expect(menu.getByRole("link", { name: "Genel Bakış" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Üyeler ve Güvenlik" })).toHaveCount(0);
  });

  test("onay bekleyen kullanıcı modüllere erişemez", async ({ page }) => {
    await loginAs(page, ACCOUNTS.bekleyen);

    await expect(page.getByRole("heading", { name: "Üyelik Onayı Bekleniyor" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Eğitim Materyalleri" })).toHaveCount(0);
  });
});

test("N3: gönder butonu sunucu HTML'inde devre dışı, hydration sonrası etkin", async ({ page }) => {
  const response = await page.goto("/login");
  const html = (await response?.text()) ?? "";
  expect(html).toMatch(/id="login-submit-btn"[^>]*disabled=""/);
  await expect(page.getByRole("button", { name: "Giriş yap" })).toBeEnabled();
});
