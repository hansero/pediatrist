import type { Page } from "@playwright/test";
import { seriousViolations, settle } from "./fixtures/a11y";
import { ACCOUNTS, loginAs } from "./fixtures/auth";
import { expect, test } from "./fixtures/test";

/**
 * F8.1: ana sayfalarda otomatik erişilebilirlik denetimi (axe-core, WCAG 2.1 A/AA). Ciddi ve kritik ihlal
 * kalmamalıdır. Sekmeli sayfalarda her sekme ayrı denetlenir. Her iki proje (masaüstü, telefon) koşar.
 */
async function check(page: Page, label: string) {
  await settle(page);
  // soft: bir sayfadaki ihlal diğer sayfaların denetimini durdurmaz (tam liste raporlanır).
  expect.soft(await seriousViolations(page), label).toEqual([]);
}

async function tabs(page: Page, names: string[], prefix: string) {
  for (const name of names) {
    await page.getByRole("tab", { name, exact: true }).click();
    await check(page, `${prefix} › ${name}`);
  }
}

test("herkese açık sayfalar", async ({ page }) => {
  for (const path of ["/login", "/register", "/reset", "/kvkk"]) {
    await page.goto(path);
    await check(page, path);
  }
});

test("hekim sayfaları", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAs(page, ACCOUNTS.asistan2);
  for (const path of [
    "/dashboard",
    "/attendance",
    "/quizzes",
    "/materials",
    "/calculators",
    "/account/security",
    "/account/device",
  ]) {
    await page.goto(path);
    await check(page, `hekim ${path}`);
  }
});

test("eğitim sorumlusu sayfaları ve sekmeleri", async ({ page }) => {
  test.setTimeout(180_000);
  await loginAs(page, ACCOUNTS.admin);
  for (const path of ["/dashboard", "/calculators", "/account/security"]) {
    await page.goto(path);
    await check(page, `admin ${path}`);
  }
  await page.goto("/admin");
  await tabs(page, ["Üyeler", "Davetler", "Denetim kayıtları"], "admin /admin");
  await page.goto("/attendance");
  await check(page, "admin /attendance");
  await page.goto("/quizzes");
  await check(page, "admin /quizzes");
  await page.goto("/materials");
  await check(page, "admin /materials");
});

test("onay bekleyen hesap ekranı", async ({ page }) => {
  await loginAs(page, ACCOUNTS.bekleyen);
  await check(page, "bekleyen");
});
