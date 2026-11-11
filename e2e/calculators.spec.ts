import { ACCOUNTS, loginAs } from "./fixtures/auth";
import { countAuditLogs } from "./fixtures/emulator";
import { expect, expectNoHorizontalOverflow, guardedContext, test } from "./fixtures/test";

/**
 * F7.4 (D8): hesaplayıcılar dürüst "Yakında" durumunda; hiçbir güvenlik denetimi "etkin" gösterilmez.
 * Admin'in protokol notu sunucuya (callable + denetim kaydı) yazılır ve hekim ekranına canlı yansır.
 */
const CALC = "Pediatrik acil / PALS resüsitasyon dozları";
const CALC_ID = "calc_pals_emergency";

test("admin protokol notu ekler → hekim canlı görür; not kaldırılır; çalışmayan özellik iddiası yok", async ({
  browser,
}, testInfo) => {
  const note = `Kurum PALS protokolü (${testInfo.project.name} ${Date.now()}): resüsitasyon arabası kartına bakın.`;

  const doctorCtx = await guardedContext(await browser.newContext());
  const doctor = await doctorCtx.newPage();
  await loginAs(doctor, ACCOUNTS.asistan2);
  await doctor.goto("/calculators");
  await expect(doctor.getByRole("heading", { level: 1 })).toHaveText("Pediatri hesaplayıcıları");
  await expect(doctor.getByRole("status").filter({ hasText: "Bu sayfada henüz hesaplama yapılmaz." })).toBeVisible();
  const cards = doctor.getByRole("list", { name: "Planlanan hesaplayıcılar" }).getByRole("listitem");
  await expect(cards).toHaveCount(5);
  for (const card of await cards.all()) await expect(card).toContainText("Yakında");
  // Eski sayfadaki gibi "aktif" güvenlik kilidi iddiası yok; denetimler "henüz etkin değil" diye etiketli.
  await expect(doctor.getByText(/kilidi|aktif/i)).toHaveCount(0);
  await expect(doctor.getByText("Planlanan güvenlik denetimi (henüz etkin değil)")).toHaveCount(5);
  // Hekimde düzenleme yok.
  await expect(doctor.getByRole("button", { name: /protokol notunu düzenle/ })).toHaveCount(0);
  await expectNoHorizontalOverflow(doctor);

  const adminCtx = await guardedContext(await browser.newContext());
  const admin = await adminCtx.newPage();
  await loginAs(admin, ACCOUNTS.admin);
  await admin.goto("/calculators");
  const before = await countAuditLogs("CALCULATOR_NOTE_UPDATED", CALC_ID);

  // Kaydet: yalnızca sunucu yanıtından sonra bildirim; çok uzun not sunucuda reddedilir.
  await admin.getByRole("button", { name: `${CALC}: protokol notunu düzenle` }).click();
  const dialog = admin.getByRole("dialog", { name: "Klinik protokol notu" });
  await dialog.getByLabel("Protokol notu").fill("a".repeat(2001));
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(dialog.getByRole("alert")).toContainText("en fazla 2000 karakter");
  await dialog.getByLabel("Protokol notu").fill(note);
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });
  await expect(admin.getByRole("status").filter({ hasText: "Protokol notu kaydedildi." })).toBeVisible();
  expect(await countAuditLogs("CALCULATOR_NOTE_UPDATED", CALC_ID)).toBe(before + 1);

  // Hekim sayfayı yenilemeden görür (kim yazdı ile birlikte).
  const doctorNote = doctor.getByRole("region", { name: `${CALC}: klinik protokol notu` });
  await expect(doctorNote).toContainText(note);
  await expect(doctorNote).toContainText("Prof. Dr.");

  // Boş kaydetmek notu kaldırır.
  await admin.getByRole("button", { name: `${CALC}: protokol notunu düzenle` }).click();
  await dialog.getByLabel("Protokol notu").fill("");
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(admin.getByRole("status").filter({ hasText: "Protokol notu kaldırıldı." })).toBeVisible();
  await expect(doctorNote).toContainText("Eğitim sorumlusu henüz protokol notu eklemedi.");
  expect(await countAuditLogs("CALCULATOR_NOTE_CLEARED", CALC_ID)).toBeGreaterThanOrEqual(1);

  await doctorCtx.close();
  await adminCtx.close();
});
