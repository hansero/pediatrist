import { ACCOUNTS, loginAs } from "./fixtures/auth";
import { deleteField, hasField } from "./fixtures/emulator";
import { expect, guardedContext, test } from "./fixtures/test";
import { withVirtualAuthenticator } from "./fixtures/webauthn";

/**
 * F4.2 (D6): yoklama cihazı = WebAuthn platform passkey'i. Chromium'un sanal doğrulayıcısı (CDP) gerçek bir
 * telefonun yüz/parmak izi doğrulayıcısı gibi davranır; kayıt yanıtı sunucuda `@simplewebauthn/server` ile doğrulanır.
 * (Yoklamadaki imza doğrulaması functions testlerinde yazılım doğrulayıcıyla sınanır; arayüz akışı F4.4'te.)
 */
const UID = "seed-asistan-4";
const EMAIL = "asistan4@pediatrist.test";

test("yoklama cihazı: passkey kaydı sunucuda doğrulanır; admin sıfırlayınca oturum kapanır ve yeniden kayıt yapılır", async ({
  browser,
}) => {
  await deleteField(`users/${UID}`, "webauthn");
  const userCtx = await guardedContext(await browser.newContext());
  const user = await userCtx.newPage();
  const { cdp, id } = await withVirtualAuthenticator(userCtx, user);

  // 1) Kayıt
  await loginAs(user, EMAIL);
  await user.goto("/account/device");
  const card = user.getByRole("region", { name: "Bu hesaba kayıtlı cihaz" });
  await expect(card).toContainText("Kayıtlı değil");
  const register = user.getByRole("button", { name: "Bu cihazı kaydet" });
  await expect(register).toBeEnabled();
  await register.click();
  await expect(card.getByRole("status").filter({ hasText: "Cihaz kaydedildi" })).toBeVisible();
  await expect(card.locator(".sec-chip")).toHaveText("Kayıtlı");
  expect(await hasField(`users/${UID}`, "webauthn")).toBe(true);
  const { credentials } = await cdp.send("WebAuthn.getCredentials", { authenticatorId: id });
  expect(credentials).toHaveLength(1);
  expect(credentials[0].rpId).toBe("localhost");

  // 2) Admin cihazı sıfırlar → passkey bağı silinir, üyenin oturumu güvenlik nedeniyle kapanır.
  const adminCtx = await guardedContext(await browser.newContext());
  const admin = await adminCtx.newPage();
  await loginAs(admin, ACCOUNTS.admin);
  await admin.goto("/admin");
  await admin.locator(`#admin-reset-dev-${UID}`).click();
  await expect(user).toHaveURL(/\/login\?neden=oturum-sonlandi$/, { timeout: 15_000 });
  await expect.poll(() => hasField(`users/${UID}`, "webauthn")).toBe(false);

  // 3) Yeniden giriş (iptal zamanı saniye çözünürlüklü) → cihaz yeniden kaydedilebilir.
  await user.waitForTimeout(1100);
  await loginAs(user, EMAIL);
  await user.goto("/account/device");
  await expect(card).toContainText("Kayıtlı değil");
  await user.getByRole("button", { name: "Bu cihazı kaydet" }).click();
  await expect(card.locator(".sec-chip")).toHaveText("Kayıtlı");

  await userCtx.close();
  await adminCtx.close();
});

test("passkey onayı iptal edilirse Türkçe hata gösterilir ve cihaz kaydedilmez", async ({ browser }) => {
  await deleteField(`users/${UID}`, "webauthn");
  const ctx = await guardedContext(await browser.newContext());
  const page = await ctx.newPage();
  const { cdp, id } = await withVirtualAuthenticator(ctx, page);
  // Kullanıcı yüz/parmak izi onayını vermiyor.
  await cdp.send("WebAuthn.setUserVerified", { authenticatorId: id, isUserVerified: false });

  await loginAs(page, EMAIL);
  await page.goto("/account/device");
  await page.getByRole("button", { name: "Bu cihazı kaydet" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /iptal edildi|tekrar deneyin/i })).toBeVisible();
  expect(await hasField(`users/${UID}`, "webauthn")).toBe(false);
  await ctx.close();
});
