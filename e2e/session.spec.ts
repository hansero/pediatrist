import { expect, guardedContext, test } from "./fixtures/test";
import { ACCOUNTS, loginAs } from "./fixtures/auth";
import { findUserProfileByEmail } from "./fixtures/emulator";
import { REGISTRATION_PASSWORD, fillRegistration } from "./fixtures/registration";

/**
 * Canlı oturum (F2.4): asistanın ekranı, admin'in başka bir tarayıcıda yaptığı değişikliğe
 * SAYFA YENİLENMEDEN tepki verir. Seed hesaplarını bozmamak için test kendi kullanıcısını oluşturur.
 */
test("onay → canlı aktifleşme; cihaz sıfırlama → oturum sonlanır; askıya alma → oturum kapanır", async ({
  browser,
}, testInfo) => {
  const email = `canli.${testInfo.project.name}.${Date.now()}@example.test`;
  const fullName = "Canlı Oturum Asistanı";

  const userCtx = await guardedContext(await browser.newContext());
  const adminCtx = await guardedContext(await browser.newContext());
  const user = await userCtx.newPage();
  const admin = await adminCtx.newPage();

  // 1) Asistan kayıt olur ve onay bekleme ekranını görür.
  await fillRegistration(user, email, "", fullName);
  await expect(user).toHaveURL(/\/pending$/);
  const uid = String((await findUserProfileByEmail(email))?.uid);
  await user.goto("/dashboard");
  await expect(user.getByRole("heading", { name: "Üyelik Onayı Bekleniyor" })).toBeVisible();

  // 2) Admin kendi tarayıcısında onaylar → asistanın ekranı yenilenmeden panele geçer.
  await loginAs(admin, ACCOUNTS.admin);
  await admin.goto("/admin");
  await admin.locator(`#admin-approve-${uid}`).click();
  await expect(user.getByRole("heading", { level: 1 })).toContainText(fullName, { timeout: 15_000 });
  await expect(user).toHaveURL(/\/dashboard$/);

  // 3) Admin cihaz eşleşmesini sıfırlar → oturum iptal zamanı yazılır → asistanın oturumu kapanır.
  await admin.locator(`#admin-reset-dev-${uid}`).click();
  await expect(user).toHaveURL(/\/login\?neden=oturum-sonlandi$/, { timeout: 15_000 });
  await expect(user.getByRole("status").filter({ hasText: "güvenlik nedeniyle sonlandırıldı" })).toBeVisible();

  // 4) Asistan yeniden giriş yapar (iptal zamanı saniye çözünürlüklü; aynı saniyede açılan oturum da geçersiz sayılır).
  await user.waitForTimeout(1100);
  await loginAs(user, email, REGISTRATION_PASSWORD);
  await expect(user.getByRole("heading", { level: 1 })).toContainText(fullName);

  // 5) Admin askıya alır → asistanın oturumu anında kapanır.
  await admin.locator(`#admin-suspend-${uid}`).click();
  await expect(user).toHaveURL(/\/login\?neden=askida$/, { timeout: 15_000 });
  await expect(user.getByRole("status").filter({ hasText: "askıya alındı" })).toBeVisible();
  expect(await findUserProfileByEmail(email)).toMatchObject({ status: "suspended" });

  await userCtx.close();
  await adminCtx.close();
});
