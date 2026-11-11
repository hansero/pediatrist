import { expect, guardedContext, test } from "./fixtures/test";
import { ACCOUNTS, loginAs } from "./fixtures/auth";
import { findUserProfileByEmail } from "./fixtures/emulator";
import { REGISTRATION_PASSWORD, fillRegistration } from "./fixtures/registration";
import { runMemberAction } from "./fixtures/admin";

/**
 * Canlı oturum (F2.4): asistanın ekranı, admin'in başka bir tarayıcıda yaptığı değişikliğe
 * SAYFA YENİLENMEDEN tepki verir. Seed hesaplarını bozmamak için test kendi kullanıcısını oluşturur.
 */
test("onay → canlı aktifleşme; iki aşamalı doğrulama sıfırlama → oturum sonlanır; askıya alma → oturum kapanır", async ({
  browser,
}, testInfo) => {
  const email = `canli.${testInfo.project.name}.${Date.now()}@example.test`;
  const fullName = "Canlı Oturum Asistanı";

  const userCtx = await guardedContext(await browser.newContext());
  const adminCtx = await guardedContext(await browser.newContext());
  const user = await userCtx.newPage();
  const admin = await adminCtx.newPage();

  // 1) Asistan kayıt olur ve onay bekleme ekranını görür.
  await fillRegistration(user, email, { fullName });
  await expect(user).toHaveURL(/\/dashboard$/);
  await expect(user.getByRole("heading", { name: "Başvurunuz onay bekliyor" })).toBeVisible();

  // 2) Admin kendi tarayıcısında onaylar → asistanın ekranı yenilenmeden panele geçer.
  await loginAs(admin, ACCOUNTS.admin);
  await runMemberAction(admin, email, "Üyeliği onayla", "Onayla", `${fullName} onaylandı.`);
  await expect(user.getByRole("heading", { level: 1 })).toContainText(fullName, { timeout: 15_000 });
  await expect(user).toHaveURL(/\/dashboard$/);

  // 3) Admin iki aşamalı doğrulamayı sıfırlar (F7.1) → oturum iptal zamanı yazılır → asistanın oturumu kapanır.
  //    (Cihaz sıfırlama aynı iptali yapar; device.spec kayıtlı passkey ile sınar.)
  await runMemberAction(
    admin,
    email,
    "İki aşamalı doğrulamayı sıfırla",
    "Doğrulamayı sıfırla",
    "iki aşamalı doğrulaması sıfırlandı"
  );
  await expect(user).toHaveURL(/\/login\?neden=oturum-sonlandi$/, { timeout: 15_000 });
  await expect(user.getByRole("status").filter({ hasText: "güvenlik nedeniyle sonlandırıldı" })).toBeVisible();

  // 4) Asistan yeniden giriş yapar (iptal zamanı saniye çözünürlüklü; aynı saniyede açılan oturum da geçersiz sayılır).
  await user.waitForTimeout(1100);
  await loginAs(user, email, REGISTRATION_PASSWORD);
  await expect(user.getByRole("heading", { level: 1 })).toContainText(fullName);

  // 5) Admin askıya alır → asistanın oturumu anında kapanır.
  await runMemberAction(admin, email, "Askıya al", "Askıya al", `${fullName} askıya alındı.`);
  await expect(user).toHaveURL(/\/login\?neden=askida$/, { timeout: 15_000 });
  await expect(user.getByRole("status").filter({ hasText: "askıya alındı" })).toBeVisible();
  expect(await findUserProfileByEmail(email)).toMatchObject({ status: "suspended" });

  await userCtx.close();
  await adminCtx.close();
});
