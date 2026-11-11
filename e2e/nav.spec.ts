import { ACCOUNTS, loginAs } from "./fixtures/auth";
import { isPhone, openMenu } from "./fixtures/nav";
import { expect, expectNoHorizontalOverflow, test } from "./fixtures/test";

/**
 * F3.2: korumalı alan gezinmesi (1280 px kenar çubuğu, 390 px çekmece).
 * Menü geçişi istemci tarafında olur: sayfa yeniden yüklenmez, oturum yeniden doğrulanmaz.
 */
test("menüden geçiş sayfayı yeniden yüklemez; aktif sayfa işaretlenir", async ({ page }) => {
  await loginAs(page, ACCOUNTS.admin);
  await expect(page).toHaveURL(/\/dashboard$/);
  // Tam sayfa yüklemesinde bu işaret kaybolur.
  await page.evaluate(() => ((window as unknown as { __navMarker: number }).__navMarker = 42));

  let menu = await openMenu(page);
  await expect(menu.getByRole("link", { name: "Genel Bakış" })).toHaveAttribute("aria-current", "page");
  await menu.getByRole("link", { name: "Eğitim Materyalleri" }).click();

  await expect(page).toHaveURL(/\/materials$/);
  await expectNoHorizontalOverflow(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Materyal yönetimi");
  expect(await page.evaluate(() => (window as unknown as { __navMarker?: number }).__navMarker)).toBe(42);
  if (isPhone(page)) await expect(page.getByRole("dialog", { name: "Menü" })).toHaveCount(0);

  menu = await openMenu(page);
  await expect(menu.getByRole("link", { name: "Eğitim Materyalleri" })).toHaveAttribute("aria-current", "page");
  await expect(menu.getByRole("link", { name: "Genel Bakış" })).not.toHaveAttribute("aria-current", "page");
});

test("telefon: kenar çubuğu yerine çekmece; klavyeyle açılır, Esc ile kapanır, odak geri döner", async ({ page }) => {
  test.skip(!isPhone(page), "Yalnızca dar ekran");
  await loginAs(page, ACCOUNTS.asistan2);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await expect(page.locator(".app-sidebar--desktop")).toBeHidden();
  const toggle = page.getByRole("button", { name: "Menü", exact: true });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Menü" });
  await expect(drawer).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true);

  // Odak tuzağı: Tab çekmeceden çıkmaz.
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true);

  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(toggle).toBeFocused();
});

test("geniş ekran: 'İçeriğe geç' bağlantısı ilk Tab'da görünür ve içeriğe atlar", async ({ page }) => {
  test.skip(isPhone(page), "Yalnızca geniş ekran");
  await loginAs(page, ACCOUNTS.asistan2);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.locator("body").focus();
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "İçeriğe geç" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("bilinmeyen adres: Türkçe 404 sayfası ve geri dönüş bağlantısı", async ({ page }) => {
  const response = await page.goto("/olmayan-sayfa");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Sayfa bulunamadı" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Genel bakışa dön" })).toHaveAttribute("href", "/dashboard");
});

test("oturum yokken korumalı sayfa girişe yönlendirir (geçmişe kayıt bırakmadan)", async ({ page }) => {
  await page.goto("/login");
  await page.goto("/materials");
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await expect(page).not.toHaveURL(/\/materials$/);
});
