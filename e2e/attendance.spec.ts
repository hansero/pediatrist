import { ACCOUNTS, loginAs } from "./fixtures/auth";
import { closeLiveLectures, deleteField } from "./fixtures/emulator";
import { expect, expectNoHorizontalOverflow, guardedContext, test } from "./fixtures/test";
import { registerDeviceViaUi, withVirtualAuthenticator } from "./fixtures/webauthn";

/**
 * F4.3: gerçek yoklama akışı (sahte veri yok). Admin dersi başlatır → projektör kodu sunucudan gelir →
 * hekim QR bağlantısıyla açar, telefonunun passkey onayıyla katılır → admin listesi canlı güncellenir →
 * mazeret girilir → ders bitirilir → projektör ve hekim ekranı kapanışı görür.
 */
const DOCTOR_UID = "seed-asistan-3";
const DOCTOR_EMAIL = "asistan3@pediatrist.test";

test("ders başlat → projektör kodu → hekim passkey ile katılır → canlı liste → mazeret → dersi bitir", async ({
  browser,
}, testInfo) => {
  test.setTimeout(90_000);
  await closeLiveLectures();
  await deleteField(`users/${DOCTOR_UID}`, "webauthn");
  const title = `E2E dersi ${testInfo.project.name} ${Date.now()}`;

  // Hekim: telefonunu (sanal doğrulayıcı) yoklama cihazı olarak kaydeder.
  const doctorCtx = await guardedContext(await browser.newContext());
  const doctor = await doctorCtx.newPage();
  await withVirtualAuthenticator(doctorCtx, doctor);
  await loginAs(doctor, DOCTOR_EMAIL);
  await registerDeviceViaUi(doctor);
  await doctor.goto("/attendance");
  await expect(doctor.getByText("Şu anda açık ders yoklaması yok")).toBeVisible();

  // Admin: dersi başlatır.
  const adminCtx = await guardedContext(await browser.newContext());
  const admin = await adminCtx.newPage();
  await loginAs(admin, ACCOUNTS.admin);
  await admin.goto("/attendance");
  await admin.getByLabel("Ders başlığı").fill(title);
  await admin.getByLabel("Yoklama süresi (dakika)").fill("10");
  await admin.getByRole("button", { name: "Yoklamayı başlat" }).click();
  const liveCard = admin.getByRole("region", { name: title });
  await expect(liveCard.getByText("Yoklama açık")).toBeVisible();

  // Hekim ekranı yenilenmeden canlı dersi görür.
  await expect(doctor.getByRole("region", { name: title })).toBeVisible();

  // Projektör: kod sunucudan gelir, QR gösterilir.
  const projectorHref = await liveCard.getByRole("link", { name: "Projektör ekranını aç" }).getAttribute("href");
  const sessionId = decodeURIComponent(String(projectorHref).split("/").pop()!);
  const projector = await adminCtx.newPage();
  await projector.goto(String(projectorHref));
  const codeEl = projector.getByTestId("projector-code");
  await expect(codeEl).toHaveText(/^[A-Z0-9]{6}$/);
  await expect(projector.getByRole("img", { name: /QR kod/ })).toBeVisible();
  const code = (await codeEl.textContent())!.trim();
  // Kod tek satırda ve kırpılmadan sığmalı (salonun arkasından okunur).
  expect(await codeEl.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);

  // Hekim: QR'daki bağlantıyla gelir (kod önceden dolu) ve yüz/parmak izi onayıyla katılır.
  await doctor.goto(`/attendance?s=${encodeURIComponent(sessionId)}&c=${code}`);
  await expect(doctor.getByLabel("Projektördeki kod")).toHaveValue(code);
  await doctor.getByRole("button", { name: "Yoklamaya katıl" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "Yoklamanız alındı" })).toBeVisible();

  // Admin listesi ve sayaç canlı güncellenir; projektördeki sayaç da.
  await expect(admin.getByTestId("present-count")).toHaveText(/^1 \/ \d+$/);
  const roster = admin.getByRole("table", { name: "Canlı ders katılım listesi" });
  await expect(roster.getByRole("row").filter({ hasText: "Katıldı" })).toHaveCount(1);
  await expectNoHorizontalOverflow(admin);
  await expectNoHorizontalOverflow(doctor);
  await expect(projector.getByLabel("Katılan hekim sayısı")).toContainText("1 /");

  // Mazeret: bekleyen ilk hekim.
  await roster
    .getByRole("button", { name: /mazeret gir$/ })
    .first()
    .click();
  const excuseDialog = admin.getByRole("dialog", { name: "Mazeret gir" });
  await excuseDialog.getByLabel("Mazeret notu").fill("Nöbet ertesi");
  await excuseDialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(excuseDialog).toHaveCount(0);
  await expect(roster.getByRole("row").filter({ hasText: "Mazeretli" })).toHaveCount(1);

  // Dersi bitir (onay penceresiyle).
  await liveCard.getByRole("button", { name: "Dersi bitir" }).click();
  const confirm = admin.getByRole("alertdialog", { name: "Ders yoklamasını bitir" });
  await expect(confirm.getByRole("button", { name: "Vazgeç" })).toBeFocused();
  await confirm.getByRole("button", { name: "Dersi bitir" }).click();
  await expect(admin.getByRole("button", { name: "Yoklamayı başlat" })).toBeVisible();
  const recent = admin.getByRole("table", { name: "Son kapanan ders yoklamaları" });
  await expect(recent.getByRole("row").filter({ hasText: title })).toContainText("Eğitici kapattı");

  await expect(projector.getByRole("heading", { name: "Yoklama kapandı" })).toBeVisible();
  await expect(doctor.getByText("Şu anda açık ders yoklaması yok")).toBeVisible();

  // F4.4: hekimin kişisel geçmişinde ders "Katıldım"; kapanışta katılmayanlar "katılmadı" sayılır (D22).
  const history = doctor.getByRole("table", { name: "Kişisel ders katılım geçmişi" });
  await expect(history.getByRole("row").filter({ hasText: title })).toContainText("Katıldım");
  await expect(recent.getByRole("row").filter({ hasText: title })).toContainText(/\d/);

  await doctorCtx.close();
  await adminCtx.close();
});

test("hekim projektör ekranını açamaz", async ({ page }) => {
  await loginAs(page, ACCOUNTS.asistan2);
  await page.goto("/attendance/projector/herhangi-bir-ders");
  await expect(page.getByRole("alert").filter({ hasText: "yalnızca eğitim sorumlusu" })).toBeVisible();
});

test("kişisel geçmiş: katılmadığı ders 'Katılmadım' olarak görünür, katılım oranı hesaplanır (D22)", async ({
  page,
}) => {
  await loginAs(page, "asistan4@pediatrist.test");
  await page.goto("/attendance");
  const history = page.getByRole("table", { name: "Kişisel ders katılım geçmişi" });
  await expect(
    history.getByRole("row").filter({ hasText: "Sabah Olgu Sunumu: Ateşli Süt Çocuğuna Yaklaşım" })
  ).toContainText("Katılmadım");
  // asistan4 hiçbir derse katılmadı: oran = katıldım / (katıldım + katılmadım) = %0 (mazeretliler paydada değil).
  const rate = page.locator("dl.history-stats > div").filter({ has: page.getByText("Katılım oranı", { exact: true }) });
  const zero = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 }).format(0);
  await expect(rate.locator("dd")).toHaveText(zero);
});
