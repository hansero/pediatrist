import { readFileSync } from "node:fs";
import type { Locator, Page } from "@playwright/test";
import { seriousViolations } from "./fixtures/a11y";
import { createMember, memberRow, openMemberMenu } from "./fixtures/admin";
import { ACCOUNTS, loginAs } from "./fixtures/auth";
import { countAuditLogs, hasField, readDocument } from "./fixtures/emulator";
import { REGISTRATION_PASSWORD } from "./fixtures/registration";
import { expect, expectNoHorizontalOverflow, guardedContext, test } from "./fixtures/test";

/**
 * F9.1 KVKK: aydınlatma metni onayı, kişisel veri dökümü ve üye silme. Her test kendi üyesini oluşturur;
 * seed hesapları değişmez. Sonuçlar emülatörden (profil, denetim kaydı) ve indirilen dosyadan doğrulanır.
 */
async function downloadJson(page: Page, trigger: Locator) {
  const [download] = await Promise.all([page.waitForEvent("download"), trigger.click()]);
  return {
    fileName: download.suggestedFilename(),
    data: JSON.parse(readFileSync((await download.path())!, "utf8")) as Record<string, unknown>,
  };
}

test("onaysız üye içerik yerine onay ekranını görür; onaylayınca panel açılır", async ({ page }, testInfo) => {
  const stamp = Date.now();
  const email = `onay.${testInfo.project.name}.${stamp}@example.test`;
  const fullName = `Onay Asistanı ${stamp % 100_000}`;
  const uid = await createMember(email, fullName, { status: "active", consent: false });

  await loginAs(page, email, REGISTRATION_PASSWORD);
  await expect(page.getByRole("heading", { level: 1, name: "Aydınlatma metnini onaylayın" })).toBeVisible();
  // Metin hukuk birimince onaylanana kadar taslak olduğu açıkça söylenir.
  await expect(page.getByRole("status").filter({ hasText: "Taslak metin" })).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  expect(await seriousViolations(page)).toEqual([]);
  await expectNoHorizontalOverflow(page);

  // Kutu işaretlenmeden onay gönderilmez.
  await page.getByRole("button", { name: "Onayla" }).click();
  await expect(page.getByText("Devam etmek için aydınlatma metnini okuduğunuzu onaylayın.")).toBeVisible();
  expect(await hasField(`users/${uid}`, "consent")).toBe(false);

  await page.getByRole("checkbox", { name: /aydınlatma metnini okudum/ }).check();
  await page.getByRole("button", { name: "Onayla" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(fullName, { timeout: 15_000 });
  expect(await hasField(`users/${uid}`, "consent")).toBe(true);
  expect(await countAuditLogs("MEMBER_CONSENT_ACCEPTED", uid)).toBe(1);

  // Üye kendi verisini indirir (KVKK md. 11).
  await page.goto("/account/security");
  const { fileName, data } = await downloadJson(page, page.getByRole("button", { name: "Verilerimi indir" }));
  expect(fileName).toMatch(/^pediatrist-veri-dokumu-onay-asistani-\d+-\d{4}-\d{2}-\d{2}\.json$/);
  expect(data.profile).toMatchObject({ uid, email, fullName, role: "user", status: "active" });
  expect(data).toHaveProperty("quizAttempts");
  expect(data).toHaveProperty("attendance");
  await expect(page.getByRole("status").filter({ hasText: "Veri dökümünüz indirildi." })).toBeVisible();
  expect(await countAuditLogs("MEMBER_DATA_EXPORTED", uid)).toBe(1);
});

test("admin veri dökümünü indirir ve üyeyi adını yazarak siler; üyenin açık oturumu kapanır, yeniden giremez", async ({
  browser,
}, testInfo) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const email = `silinecek.${testInfo.project.name}.${stamp}@example.test`;
  const fullName = `Silinecek Asistan ${stamp % 100_000}`;
  const name = `Asistan Dr. ${fullName}`;
  const uid = await createMember(email, fullName, { status: "active" });

  const memberCtx = await guardedContext(await browser.newContext());
  const member = await memberCtx.newPage();
  await loginAs(member, email, REGISTRATION_PASSWORD);
  await expect(member.getByRole("heading", { level: 1 })).toContainText(fullName);

  const adminCtx = await guardedContext(await browser.newContext());
  const admin = await adminCtx.newPage();
  await loginAs(admin, ACCOUNTS.admin);
  await admin.goto("/admin");
  await admin.getByLabel("Ara").fill(email);
  await memberRow(admin, email);

  // 1) Döküm: onay diyaloğu işlemin denetim kaydına geçeceğini söyler; dosya sunucu yanıtından sonra iner.
  let menu = await openMemberMenu(admin, email);
  await menu.getByRole("button", { name: "Veri dökümünü indir" }).click();
  const exportDialog = admin.getByRole("alertdialog", { name: "Veri dökümünü indir" });
  await expect(exportDialog).toContainText("denetim kaydına geçer");
  const { data } = await downloadJson(admin, exportDialog.getByRole("button", { name: "Dökümü indir" }));
  expect(data.profile).toMatchObject({ uid, email });
  await expect(admin.getByRole("status").filter({ hasText: `${name}: veri dökümü indirildi.` })).toBeVisible();

  // 2) Silme: ad yazılmadan düğme kapalı; uyarı geri alınamaz olduğunu söyler.
  menu = await openMemberMenu(admin, email);
  await menu.getByRole("button", { name: "Üyeyi sil" }).click();
  const dialog = admin.getByRole("alertdialog", { name: "Üyeyi sil" });
  await expect(dialog).toContainText("geri alınamaz");
  const confirm = dialog.getByRole("button", { name: "Üyeyi sil" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/Onaylamak için/).fill(name);
  await confirm.click();
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });
  await expect(admin.getByRole("status").filter({ hasText: `${name} silindi` })).toBeVisible();
  await expect(admin.getByRole("row").filter({ hasText: email })).toHaveCount(0);
  expect(await readDocument(`users/${uid}`)).toBeNull();
  expect(await countAuditLogs("MEMBER_DELETED", uid)).toBe(1);

  // 3) Üyenin açık oturumu kayıt formuna değil, nedeni söyleyen giriş ekranına düşer.
  await expect(member).toHaveURL(/\/login\?neden=hesap-silindi$/, { timeout: 15_000 });
  await expect(member.getByRole("status").filter({ hasText: "Hesabınız silindi." })).toBeVisible();

  // 4) Aynı bilgilerle yeniden giriş yapılamaz (giriş hesabı silindi).
  await loginAs(member, email, REGISTRATION_PASSWORD, { expectSuccess: false });
  await expect(member.getByRole("alert").first()).toBeVisible();
  await expect(member).toHaveURL(/\/login/);

  // Denetim kaydı ekranda "Kritik" olarak görünür.
  await admin.getByRole("tab", { name: "Denetim kayıtları" }).click();
  await admin.getByLabel("Önem").selectOption("CRITICAL");
  const audit = admin.getByRole("table", { name: "Denetim kayıtları" });
  await expect(audit.getByRole("row").filter({ hasText: uid }).filter({ hasText: "Üye silindi" })).toHaveCount(1);

  await memberCtx.close();
  await adminCtx.close();
});
