import { readFileSync } from "node:fs";
import type { Browser, Download, Locator, Page } from "@playwright/test";
import { ACCOUNTS, loginAs } from "./fixtures/auth";
import { closeLiveLectures, countAuditLogs, deleteField } from "./fixtures/emulator";
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

// --- F4.5: raporlar ------------------------------------------------------------------------------

const SEED_LECTURE = { id: "seed-ders-001", title: "Sabah Olgu Sunumu: Ateşli Süt Çocuğuna Yaklaşım" };

/** `<dl>` içinde etiketiyle eşleşen değer. */
const stat = (scope: Locator, label: string) =>
  scope
    .locator("dl > div")
    .filter({ has: scope.page().getByText(label, { exact: true }) })
    .locator("dd");

async function downloadText(page: Page, trigger: Locator): Promise<{ download: Download; text: string }> {
  const [download] = await Promise.all([page.waitForEvent("download"), trigger.click()]);
  return { download, text: readFileSync((await download.path())!, "utf8") };
}

const csvLines = (text: string) =>
  text
    .replace(/^\uFEFF/, "")
    .trimEnd()
    .split("\r\n");

async function openAdminTab(page: Page, tab: "Ders raporu" | "Hekim karnesi") {
  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/attendance");
  await page.getByRole("tab", { name: tab }).click();
  await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
}

test("ders raporu: seed dersi sayıları, eşik uyarısı ve CSV (F4.5)", async ({ page }) => {
  await openAdminTab(page, "Ders raporu");
  await page.getByLabel("Ders", { exact: true }).selectOption(SEED_LECTURE.id);
  const detail = page.getByRole("region", { name: SEED_LECTURE.title });

  // Seed: 4 beklenen; 2 katıldı, 1 mazeretli, 1 katılmadı → 2 / (2 + 1) = %67 (< %70).
  await expect(stat(detail, "Beklenen")).toHaveText("4");
  await expect(stat(detail, "Katıldı")).toHaveText("2");
  await expect(stat(detail, "Mazeretli")).toHaveText("1");
  await expect(stat(detail, "Katılmadı")).toHaveText("1");
  await expect(stat(detail, "Katılım oranı")).toContainText("67");
  await expect(stat(detail, "Katılım oranı")).toContainText("Eşik altında");
  await expect(detail.getByRole("status").filter({ hasText: "eşiğinin altında" })).toBeVisible();

  const table = detail.getByRole("table");
  await expect(table.getByRole("row").filter({ hasText: "Zeynep Ergin" })).toContainText("Katılmadı");
  await expect(table.getByRole("row").filter({ hasText: "Emre Koç" })).toContainText("Nöbet ertesi");
  await expectNoHorizontalOverflow(page);

  const { download, text } = await downloadText(
    page,
    detail.getByRole("button", { name: "Ders raporunu CSV olarak indir" })
  );
  expect(download.suggestedFilename()).toMatch(
    /^yoklama-\d{4}-\d{2}-\d{2}-sabah-olgu-sunumu-atesli-sut-cocuguna-yaklasim\.csv$/
  );
  expect(text.startsWith("\uFEFF")).toBe(true);
  const lines = csvLines(text);
  expect(lines[0]).toBe("Ders;Tarih;Eğitici;Kategori;Hekim;Kıdem;Durum;Katılım saati;Mazeret notu;Beklenen listede");
  expect(lines).toHaveLength(5);
  expect(lines.find((l) => l.includes("Zeynep Ergin"))).toContain(";4. yıl;Katılmadı;;;Evet");
  expect(lines.find((l) => l.includes("Emre Koç"))).toContain(";Mazeretli;;Nöbet ertesi;Evet");
  expect(lines.find((l) => l.includes("Kerem Yalçın"))).toMatch(/;Katıldı;\d{4}-\d{2}-\d{2} \d{2}:\d{2};;Evet$/);
});

test("hekim karnesi: eşik altındaki hekim işaretli, ders dökümü ve CSV (F4.5)", async ({ page }) => {
  await openAdminTab(page, "Hekim karnesi");
  const karne = page.getByRole("table", { name: "Hekim karnesi" });
  // Asistan-4 hiçbir derse katılmadı (seed + e2e dersleri): oran %0, eşik altında ve uyarıda adı geçer.
  const row = karne.getByRole("row").filter({ hasText: "Zeynep Ergin" });
  await expect(row).toContainText("%0");
  await expect(row).toContainText("Eşik altında");
  await expect(page.getByRole("status").filter({ hasText: "katılım oranı %70'in altında" })).toContainText(
    "Zeynep Ergin"
  );
  await expectNoHorizontalOverflow(page);

  const summary = await downloadText(page, page.getByRole("button", { name: "Hekim karnesini CSV olarak indir" }));
  expect(summary.download.suggestedFilename()).toMatch(/^hekim-karnesi-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/);
  const lines = csvLines(summary.text);
  expect(lines[0]).toBe("Hekim;Kıdem;Üyelik;Katıldı;Mazeretli;Katılmadı;Katılım oranı (%);Eşik altında (%70)");
  expect(lines.find((l) => l.startsWith("Asistan Dr. Zeynep Ergin;"))).toMatch(
    /^Asistan Dr\. Zeynep Ergin;4\. yıl;Etkin;0;0;[1-9]\d*;0;Evet$/
  );

  await row.getByRole("button", { name: "Asistan Dr. Zeynep Ergin: ders dökümü" }).click();
  const detail = page.getByRole("region", { name: "Asistan Dr. Zeynep Ergin: ders dökümü" });
  await expect(detail.getByRole("row").filter({ hasText: SEED_LECTURE.title })).toContainText("Katılmadı");
  const csv = await downloadText(
    page,
    detail.getByRole("button", { name: "CSV indir (Asistan Dr. Zeynep Ergin ders dökümü)" })
  );
  expect(csv.download.suggestedFilename()).toMatch(/^hekim-karnesi-asistan-dr-zeynep-ergin-/);
  const detailLines = csvLines(csv.text);
  expect(detailLines[0]).toBe("Hekim;Tarih;Ders;Eğitici;Kategori;Durum;Katılım saati;Mazeret notu");
  expect(detailLines.find((l) => l.includes(SEED_LECTURE.title))).toContain(";Katılmadı;;");
  await detail.getByRole("button", { name: "Kapat" }).click();
  await expect(detail).toHaveCount(0);
});

test("ders raporu: kapanmış derste katılmadı → sonradan mazeret, sayılar canlı güncellenir (F4.5, D22)", async ({
  page,
}, testInfo) => {
  await closeLiveLectures();
  const title = `E2E rapor dersi ${testInfo.project.name} ${Date.now()}`;
  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/attendance");
  await page.getByLabel("Ders başlığı").fill(title);
  await page.getByRole("button", { name: "Yoklamayı başlat" }).click();
  const liveCard = page.getByRole("region", { name: title });
  await liveCard.getByRole("button", { name: "Dersi bitir" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Dersi bitir" }).click();
  await expect(page.getByRole("button", { name: "Yoklamayı başlat" })).toBeVisible();

  await page.getByRole("tab", { name: "Ders raporu" }).click();
  const select = page.getByLabel("Ders", { exact: true });
  const value = await select.locator("option", { hasText: title }).getAttribute("value");
  await select.selectOption(value!);
  const detail = page.getByRole("region", { name: title });

  // Kimse katılmadı: kapanışta beklenen herkese "katılmadı" yazıldı (D22).
  const expected = Number(await stat(detail, "Beklenen").textContent());
  expect(expected).toBeGreaterThanOrEqual(4);
  await expect(stat(detail, "Katılmadı")).toHaveText(String(expected));
  await expect(stat(detail, "Katılım oranı")).toContainText("%0");

  const name = "Asistan Dr. Kerem Yalçın";
  await detail.getByRole("button", { name: `${name}: mazeret gir` }).click();
  const dialog = page.getByRole("dialog", { name: "Mazeret gir" });
  await dialog.getByLabel("Mazeret notu").fill("Yıllık izin");
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: `${name} mazeretli olarak işaretlendi.` })).toBeVisible();

  await expect(stat(detail, "Mazeretli")).toHaveText("1");
  await expect(stat(detail, "Katılmadı")).toHaveText(String(expected - 1));
  await expect(detail.getByRole("row").filter({ hasText: name })).toContainText("Yıllık izin");

  // Düzenlemede mevcut not dolu gelir.
  await detail.getByRole("button", { name: `${name}: mazereti düzenle` }).click();
  const editDialog = page.getByRole("dialog", { name: "Mazereti düzenle" });
  await expect(editDialog.getByLabel("Mazeret notu")).toHaveValue("Yıllık izin");
  await editDialog.getByRole("button", { name: "Vazgeç" }).click();
  await expect(editDialog).toHaveCount(0);
});

// --- F4.6: hata senaryoları ----------------------------------------------------------------------

/** Admin bağlamında dersi arayüzden başlatır ve projektörü açar. */
async function startLectureWithProjector(browser: Browser, title: string) {
  const adminCtx = await guardedContext(await browser.newContext());
  const admin = await adminCtx.newPage();
  await loginAs(admin, ACCOUNTS.admin);
  await admin.goto("/attendance");
  await admin.getByLabel("Ders başlığı").fill(title);
  await admin.getByRole("button", { name: "Yoklamayı başlat" }).click();
  const liveCard = admin.getByRole("region", { name: title });
  await expect(liveCard.getByText("Yoklama açık")).toBeVisible();
  const href = String(await liveCard.getByRole("link", { name: "Projektör ekranını aç" }).getAttribute("href"));
  const projector = await adminCtx.newPage();
  await projector.goto(href);
  const codeEl = projector.getByTestId("projector-code");
  await expect(codeEl).toHaveText(/^[A-Z0-9]{6}$/);
  return {
    adminCtx,
    admin,
    liveCard,
    sessionId: decodeURIComponent(href.split("/").pop()!),
    codeEl,
    currentCode: async () => (await codeEl.textContent())!.trim(),
    async end() {
      await liveCard.getByRole("button", { name: "Dersi bitir" }).click();
      await admin.getByRole("alertdialog").getByRole("button", { name: "Dersi bitir" }).click();
      await expect(admin.getByRole("button", { name: "Yoklamayı başlat" })).toBeVisible();
      await adminCtx.close();
    },
  };
}

test("yanlış kod ve süresi geçmiş kod reddedilir, kayıt yazılmaz; güncel kodla katılır (F4.6)", async ({
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  await closeLiveLectures();
  await deleteField("users/seed-asistan-2", "webauthn");
  const lecture = await startLectureWithProjector(browser, `E2E kod dersi ${testInfo.project.name} ${Date.now()}`);

  const doctorCtx = await guardedContext(await browser.newContext());
  const doctor = await doctorCtx.newPage();
  await withVirtualAuthenticator(doctorCtx, doctor);
  await loginAs(doctor, ACCOUNTS.asistan2);
  await registerDeviceViaUi(doctor);
  await doctor.goto("/attendance");
  const codeInput = doctor.getByLabel("Projektördeki kod");
  const submit = doctor.getByRole("button", { name: "Yoklamaya katıl" });
  const rejected = () => countAuditLogs("ATTENDANCE_EXPIRED_OR_INVALID_CODE", lecture.sessionId);
  const codeError = doctor.getByRole("alert").filter({ hasText: "Kod geçersiz veya süresi doldu" });

  // 1) Yanlış kod: cihaz imzası geçerli olsa bile sunucu reddeder.
  const firstCode = await lecture.currentCode();
  await codeInput.fill(firstCode === "AAAAAA" ? "BBBBBB" : "AAAAAA");
  await submit.click();
  await expect(codeError).toBeVisible();
  await expect.poll(rejected).toBe(1);

  // 2) Eski kod: projektör iki kez yenilendikten sonra ilk kod artık geçmez (yalnızca bir önceki pencere kabul).
  await expect.poll(lecture.currentCode, { timeout: 20_000 }).not.toBe(firstCode);
  const secondCode = await lecture.currentCode();
  await expect.poll(lecture.currentCode, { timeout: 20_000 }).not.toBe(secondCode);
  await codeInput.fill(firstCode);
  await submit.click();
  await expect.poll(rejected).toBe(2);
  await expect(codeError).toBeVisible();
  await expect(lecture.admin.getByTestId("present-count")).toHaveText(/^0 \/ \d+$/);

  // 3) Güncel kod: aynı telefonla katılım alınır.
  await codeInput.fill(await lecture.currentCode());
  await submit.click();
  await expect(doctor.getByRole("status").filter({ hasText: "Yoklamanız alındı" })).toBeVisible();
  await expect(lecture.admin.getByTestId("present-count")).toHaveText(/^1 \/ \d+$/);

  await doctorCtx.close();
  await lecture.end();
});

test("kayıtsız cihazda yoklama kapalı; başka telefondan imza denemesi Türkçe yönlendirmeyle reddedilir (F4.6)", async ({
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  await closeLiveLectures();
  await deleteField("users/seed-asistan-1", "webauthn");
  const email = "asistan1@pediatrist.test";
  const lecture = await startLectureWithProjector(browser, `E2E cihaz dersi ${testInfo.project.name} ${Date.now()}`);

  // Cihazı kayıtlı değil: uyarı ve kayıt bağlantısı; düğme kapalı (sunucuya istek gitmez).
  const otherCtx = await guardedContext(await browser.newContext());
  const other = await otherCtx.newPage();
  await loginAs(other, email);
  await other.goto("/attendance");
  const warning = other.getByRole("status").filter({ hasText: "Önce telefonunuzu kaydedin" });
  await expect(warning).toBeVisible();
  await expect(warning.getByRole("link", { name: "Yoklama cihazını kaydet" })).toHaveAttribute(
    "href",
    "/account/device"
  );
  await expect(other.getByRole("button", { name: "Yoklamaya katıl" })).toBeDisabled();

  // Hekim kendi telefonunu kaydeder.
  const phoneCtx = await guardedContext(await browser.newContext());
  const phone = await phoneCtx.newPage();
  await withVirtualAuthenticator(phoneCtx, phone);
  await loginAs(phone, email);
  await registerDeviceViaUi(phone);

  // Başka bir cihaz (kendi doğrulayıcısı var ama bu hesabın anahtarı yok): imza alınamaz, açık yönlendirme.
  await withVirtualAuthenticator(otherCtx, other);
  await other.reload();
  await expect(warning).toHaveCount(0);
  await other.getByLabel("Projektördeki kod").fill(await lecture.currentCode());
  await other.getByRole("button", { name: "Yoklamaya katıl" }).click();
  await expect(
    other.getByRole("alert").filter({ hasText: "Bu cihazda hesabınıza kayıtlı yoklama anahtarı bulunamadı" })
  ).toBeVisible();
  await expect(lecture.admin.getByTestId("present-count")).toHaveText(/^0 \/ \d+$/);

  // Kayıtlı telefonla katılım alınır.
  await phone.goto("/attendance");
  await phone.getByLabel("Projektördeki kod").fill(await lecture.currentCode());
  await phone.getByRole("button", { name: "Yoklamaya katıl" }).click();
  await expect(phone.getByRole("status").filter({ hasText: "Yoklamanız alındı" })).toBeVisible();
  await expect(lecture.admin.getByTestId("present-count")).toHaveText(/^1 \/ \d+$/);

  await otherCtx.close();
  await phoneCtx.close();
  await lecture.end();
});
