import type { Locator, Page } from "@playwright/test";

/**
 * Ana menü: geniş ekranda kenar çubuğu, telefonda "Menü" düğmesiyle açılan çekmece (F3.2).
 * Telefonda çekmeceyi açar ve menü kapsayıcısını döndürür.
 */
export async function openMenu(page: Page): Promise<Locator> {
  // `isVisible` beklemez: önce uygulama iskeletinin çizilmesini bekle.
  await page.locator(".app-shell").waitFor();
  const toggle = page.getByRole("button", { name: "Menü", exact: true });
  if (await toggle.isVisible()) {
    await toggle.click();
    return page.getByRole("dialog", { name: "Menü" });
  }
  return page.locator(".app-sidebar--desktop");
}

export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) <= 960;
