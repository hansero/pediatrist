import { createPendingMember, memberRow, openMemberMenu, runMemberAction } from "./fixtures/admin";
import { ACCOUNTS, loginAs } from "./fixtures/auth";
import { countAuditLogs, hasField, readDocument } from "./fixtures/emulator";
import { expect, expectNoHorizontalOverflow, test } from "./fixtures/test";

/**
 * F7.1 + F7.2: yönetim paneli gerçek veriyle. Her işlem sunucu yanıtı beklenerek yapılır ve sonucu
 * emülatörden doğrulanır (iyimser "başarılı" yok). Test kendi üyesini oluşturur; seed hesapları değişmez.
 */
test("üye yaşam döngüsü: onay → eğitim sorumlusu (adı yazarak) → yetki kaldırma → kıdem → askı → yeniden etkinleştirme → MFA sıfırlama", async ({
  page,
}, testInfo) => {
  const stamp = Date.now();
  const email = `panel.${testInfo.project.name}.${stamp}@example.test`;
  const fullName = `Panel Asistanı ${stamp % 100_000}`;
  const name = `Asistan Dr. ${fullName}`;
  const uid = await createPendingMember(email, fullName);

  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Üyeler ve güvenlik");
  await expectNoHorizontalOverflow(page);

  // Durum süzgeci: bekleyen üye "Onay bekleyen" altında; arama e-postayla daraltır.
  await page.getByRole("button", { name: /^Onay bekleyen/ }).click();
  await page.getByLabel("Ara").fill(email);
  let row = await memberRow(page, email);
  await expect(row).toContainText("Onay bekliyor");

  // Bekleyen üyede "Yeniden etkinleştir" yok; "Üyeliği onayla" var.
  let menu = await openMemberMenu(page, email);
  await expect(menu.getByRole("button", { name: "Yeniden etkinleştir" })).toHaveCount(0);
  await menu.getByRole("button", { name: "Kapat" }).click();

  // 1) Onay
  await runMemberAction(page, email, "Üyeliği onayla", "Onayla", `${name} onaylandı.`);
  await expect.poll(async () => (await readDocument(`users/${uid}`))?.status).toBe("active");
  // Süzgeç "Onay bekleyen"de: onaylanan üye listeden düşer; "Tümü"ne dönülür.
  await expect(page.getByRole("row").filter({ hasText: email })).toHaveCount(0);
  await page.getByRole("button", { name: "Tümü" }).click();
  row = await memberRow(page, email);
  await expect(row).toContainText("Etkin");

  // 2) Eğitim sorumlusu yap: ad yazılmadan onay butonu kapalı; yanlış ad kabul edilmez.
  menu = await openMemberMenu(page, email);
  await menu.getByRole("button", { name: "Eğitim sorumlusu yap" }).click();
  const promote = page.getByRole("alertdialog", { name: "Eğitim sorumlusu yap" });
  const grant = promote.getByRole("button", { name: "Eğitim sorumlusu yap" });
  await expect(grant).toBeDisabled();
  await promote.getByLabel(/Onaylamak için/).fill("Başka Biri");
  await expect(grant).toBeDisabled();
  await promote.getByLabel(/Onaylamak için/).fill(name.toLocaleLowerCase("tr"));
  await expect(grant).toBeEnabled();
  await grant.click();
  await expect(promote).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole("status").filter({ hasText: `${name} eğitim sorumlusu oldu.` })).toBeVisible();
  await expect.poll(async () => (await readDocument(`users/${uid}`))?.role).toBe("admin");
  await expect(row).toContainText("Eğitim sorumlusu");

  // 3) Yetkiyi kaldır
  await runMemberAction(
    page,
    email,
    "Eğitim sorumlusu yetkisini kaldır",
    "Yetkiyi kaldır",
    `${name} artık hekim rolünde.`
  );
  await expect.poll(async () => (await readDocument(`users/${uid}`))?.role).toBe("user");

  // 4) Kıdem değiştir
  menu = await openMemberMenu(page, email);
  await menu.getByRole("button", { name: "Kıdemi değiştir" }).click();
  const year = page.getByRole("dialog", { name: "Kıdemi değiştir" });
  await year.getByLabel("Kıdem yılı").selectOption("3");
  await year.getByRole("button", { name: "Kaydet" }).click();
  await expect(year).toHaveCount(0, { timeout: 15_000 });
  await expect.poll(async () => (await readDocument(`users/${uid}`))?.residencyYear).toBe(3);
  await expect(row).toContainText("3. yıl");

  // 5) Askıya al → menüde "Üyeliği onayla" değil "Yeniden etkinleştir" çıkar.
  await runMemberAction(page, email, "Askıya al", "Askıya al", `${name} askıya alındı.`);
  await expect(row).toContainText("Askıda");
  menu = await openMemberMenu(page, email);
  await expect(menu.getByRole("button", { name: "Üyeliği onayla" })).toHaveCount(0);
  await expect(menu.getByRole("button", { name: "Askıya al" })).toHaveCount(0);
  await menu.getByRole("button", { name: "Kapat" }).click();

  // 6) Yeniden etkinleştir
  await runMemberAction(page, email, "Yeniden etkinleştir", "Yeniden etkinleştir", `${name} yeniden etkinleştirildi.`);
  await expect.poll(async () => (await readDocument(`users/${uid}`))?.status).toBe("active");

  // 7) İki aşamalı doğrulamayı sıfırla → oturum iptal zamanı ve WARN denetim kaydı (sunucu yazar).
  await runMemberAction(
    page,
    email,
    "İki aşamalı doğrulamayı sıfırla",
    "Doğrulamayı sıfırla",
    `${name} adlı üyenin iki aşamalı doğrulaması sıfırlandı.`
  );
  expect(await hasField(`users/${uid}`, "tokensValidAfter")).toBe(true);
  expect(await countAuditLogs("MEMBER_MFA_RESET", uid)).toBe(1);

  // Denetim kayıtları: önem süzgeci sunucu sorgusudur; WARN kaydı "Uyarı"da var, "Bilgi"de yok.
  await page.getByRole("tab", { name: "Denetim kayıtları" }).click();
  const audit = page.getByRole("table", { name: "Denetim kayıtları" });
  const mfaRow = audit.getByRole("row").filter({ hasText: uid }).filter({ hasText: "MEMBER_MFA_RESET" });
  await expect(mfaRow).toHaveCount(1);
  await expect(mfaRow).toContainText("İki aşamalı doğrulama sıfırlandı");
  await page.getByLabel("Önem").selectOption("WARN");
  await expect(mfaRow).toHaveCount(1);
  await expect(audit.getByRole("row").filter({ hasText: "Bilgi" })).toHaveCount(0);
  await page.getByLabel("Önem").selectOption("INFO");
  await expect(audit.getByRole("row").filter({ hasText: "Bilgi" }).first()).toBeVisible();
  await expect(mfaRow).toHaveCount(0);
  // Ayrıntı: metadata açılır.
  await page.getByLabel("Önem").selectOption("WARN");
  await page.getByLabel("Modül").selectOption("admin");
  await mfaRow.getByText("Göster").click();
  await expect(mfaRow).toContainText("factorsRemoved: 0");
  await expectNoHorizontalOverflow(page);
});

test("kendi satırında yalnızca kendi veri dökümü var; rol, durum, MFA ve silme işlemi yok", async ({ page }) => {
  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin");
  await page.getByLabel("Ara").fill(ACCOUNTS.admin);
  const row = await memberRow(page, ACCOUNTS.admin);
  await expect(row).toContainText("(siz)");
  const menu = await openMemberMenu(page, ACCOUNTS.admin);
  // Kendi satırı ve kıdemi değiştirilemez (admin) → tek işlem veri dökümü (F9.1).
  await expect(menu.locator(".action-list").getByRole("button")).toHaveText(["Veri dökümünü indir"]);
  await expect(menu).toContainText("hesabınızı silemezsiniz");
});

test("davet: geçersiz e-posta sunucu hatası gösterir; oluştur → kod → iptal", async ({ page }, testInfo) => {
  const email = `davet.${testInfo.project.name}.${Date.now()}@example.test`;
  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Davetler" }).click();
  const form = page.getByRole("region", { name: "Davet oluştur" });

  await form.getByLabel("E-posta").fill("gecersiz-adres");
  await form.getByRole("button", { name: "Davet oluştur" }).click();
  await expect(form.getByRole("alert")).toContainText("Geçerli bir e-posta adresi girin.");

  await form.getByLabel("E-posta").fill(email);
  await form.getByLabel("Kıdem").selectOption("2");
  await form.getByLabel("Geçerlilik (gün)").fill("7");
  await form.getByRole("button", { name: "Davet oluştur" }).click();
  const created = form.getByRole("status").filter({ hasText: `${email} için davet kodu` });
  await expect(created).toBeVisible({ timeout: 15_000 });
  const code = (await created.locator(".invite-code").textContent())?.trim() ?? "";
  expect(code.length).toBeGreaterThanOrEqual(6);

  const list = page.getByRole("table", { name: "Davet listesi" });
  const row = list.getByRole("row").filter({ hasText: email });
  await expect(row).toContainText(code);
  await expect(row).toContainText("Hekim · 2. yıl");
  await expect(row).toContainText("Geçerli");

  await row.getByRole("button", { name: `İptal et (${email} daveti)` }).click();
  const confirm = page.getByRole("alertdialog", { name: "Daveti iptal et" });
  await expect(confirm).toContainText(code);
  await confirm.getByRole("button", { name: "Daveti iptal et" }).click();
  await expect(confirm).toHaveCount(0, { timeout: 15_000 });
  await expect(row).toContainText("İptal edildi");
  await expect(row.getByRole("button", { name: /^İptal et/ })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
