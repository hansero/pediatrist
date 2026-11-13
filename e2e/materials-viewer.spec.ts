import { ACCOUNTS, loginAs } from "./fixtures/auth";
import { expect, expectNoHorizontalOverflow, guardedContext, test } from "./fixtures/test";

/**
 * F6.3/F6.4: hekim görüntüleyicisi gerçek Storage dosyasıyla (pdf.js, CSP bekçisi açık). Seed: "Septik Şok"
 * (1–4. yıl, 3 sayfa, indirme kapalı) ve "Preterm" (1–2. yıl, indirme açık). Ekran boyutu başına ayrı hekim:
 * ilerleme kalıcıdır, aynı hekim ikinci koşuda zaten tamamlamış olurdu.
 */
const SEPSIS = "Pediatrik Septik Şok: İlk Saat Yönetimi";
const PRETERM = "Doğumhanede Preterm Yenidoğan Stabilizasyonu";

test("hekim kendi kıdemini görür; PDF'i filigranlı açar, son sayfada tamamlar; admin raporu güncellenir (F6.3)", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(90_000);
  const doctor =
    testInfo.project.name === "telefon"
      ? { email: "asistan4@pediatrist.test", name: "Zeynep Ergin", year: "4. yıl" }
      : { email: "asistan3@pediatrist.test", name: "Emre Koç", year: "3. yıl" };
  await loginAs(page, doctor.email);
  await page.goto("/materials");
  await expect(page.getByRole("heading", { level: 1, name: "Eğitim materyalleri" })).toBeVisible();

  // Varsayılan süzgeç kendi kıdemi: Preterm (1–2. yıl) görünmez; "Bütün kıdemler" ile görünür.
  const list = page.getByRole("list", { name: "Materyaller" });
  await expect(page.getByLabel("Kıdem")).toHaveValue(doctor.year.split(".")[0]);
  await expect(list.getByRole("heading", { name: SEPSIS })).toBeVisible();
  await expect(list.getByRole("heading", { name: PRETERM })).toHaveCount(0);
  await page.getByLabel("Kıdem").selectOption("all");
  await expect(list.getByRole("heading", { name: PRETERM })).toBeVisible();
  // Etiket süzgeci (D25): seçenekler yayındaki materyallerin etiketlerinden.
  await page.getByLabel("Etiket").selectOption({ label: "Neonatoloji" });
  await expect(list.getByRole("heading", { name: PRETERM })).toBeVisible();
  await expect(list.getByRole("heading", { name: SEPSIS })).toHaveCount(0);
  await page.getByLabel("Etiket").selectOption("all");
  await expect(list.getByRole("heading", { name: SEPSIS })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // PDF: pdf.js ile canvas'a çizilir (CSP bekçisi ihlal yakalar); ekran okuyucu için sayfa metni var.
  await page.getByRole("button", { name: `${SEPSIS}: aç` }).click();
  const viewer = page.getByRole("region", { name: SEPSIS, exact: true });
  await expect(viewer).toContainText("Filigranlı görüntüleme");
  await expect(page.getByText("Sayfa 1 / 3", { exact: true })).toBeVisible({ timeout: 20_000 });
  const pageRegion = page.getByRole("region", { name: `${SEPSIS}, sayfa 1` });
  expect(await pageRegion.locator("canvas").evaluate((c: HTMLCanvasElement) => c.width * c.height)).toBeGreaterThan(0);
  await expect(pageRegion.locator(".sr-only")).not.toHaveText("Bu sayfada okunabilir metin yok.");
  await expect(viewer.getByRole("link", { name: "İndir" })).toHaveCount(0); // indirme izni yok

  const complete = viewer.getByRole("button", { name: "Tamamlandı olarak işaretle" });
  await expect(complete).toBeDisabled();
  await expect(viewer).toContainText("son sayfaya kadar okuyun (1 / 3)");
  await viewer.getByRole("button", { name: "Sonraki sayfa" }).click();
  await expect(page.getByText("Sayfa 2 / 3", { exact: true })).toBeVisible();
  // Klavye ile sayfa çevirme.
  await page.getByRole("region", { name: `${SEPSIS}, sayfa 2` }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Sayfa 3 / 3", { exact: true })).toBeVisible();
  await expect(complete).toBeEnabled();
  await complete.click();
  await expect(page.getByRole("status").filter({ hasText: "Materyal tamamlandı olarak kaydedildi." })).toBeVisible();
  await expect(viewer.getByText("Tamamlandı", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await viewer.getByRole("button", { name: "Listeye dön" }).click();
  await expect(list.getByRole("listitem").filter({ has: page.getByRole("heading", { name: SEPSIS }) })).toContainText(
    "Tamamlandı"
  );

  // İndirme izni olan materyalde "İndir" var.
  await page.getByRole("button", { name: `${PRETERM}: aç` }).click();
  await expect(
    page.getByRole("region", { name: PRETERM, exact: true }).getByRole("link", { name: "İndir" })
  ).toBeVisible();

  // Admin okunma raporu: hekim tamamladı, son sayfa 3.
  const adminCtx = await guardedContext(await browser.newContext());
  const admin = await adminCtx.newPage();
  await loginAs(admin, ACCOUNTS.admin);
  await admin.goto("/materials");
  await admin
    .getByRole("table", { name: "Materyal listesi" })
    .getByRole("button", { name: `${SEPSIS}: okunma raporu` })
    .click();
  const row = admin
    .getByRole("region", { name: `${SEPSIS}: okunma raporu` })
    .getByRole("table")
    .getByRole("row")
    .filter({ hasText: doctor.name });
  await expect(row).toContainText("Tamamladı");
  // Satır başlığı (hekim) hücre sayılmaz: kıdem, durum, süre, son sayfa…
  await expect(row.getByRole("cell").nth(3)).toHaveText("3");
  await adminCtx.close();
});

test("uzman hesabı: varsayılan süzgeç 'Uzman (benim)'; yalnızca uzman hedefli materyaller ve zorunlu materyal sayısı (F11.6)", async ({
  page,
}) => {
  await loginAs(page, "uzman@pediatrist.test");
  await page.goto("/materials");
  const list = page.getByRole("list", { name: "Materyaller" });
  const kidem = page.getByLabel("Kıdem");
  await expect(kidem).toHaveValue("specialist");
  await expect(kidem.locator("option:checked")).toHaveText("Uzman (benim)");
  await expect(list.getByRole("heading", { name: SEPSIS })).toBeVisible();
  await expect(list.getByRole("heading", { name: PRETERM })).toHaveCount(0);
  await expect(list.getByRole("article").filter({ hasText: SEPSIS })).toContainText(
    "Hedef: 1. yıl, 2. yıl, 3. yıl, 4. yıl, Uzman"
  );
  // Görünürlük kısıtı yok: "Bütün kıdemler" ile asistan hedefli materyal de açılabilir.
  await kidem.selectOption("all");
  await expect(list.getByRole("heading", { name: PRETERM })).toBeVisible();

  // Ana sayfa: zorunlu materyal göstergesi yalnızca uzman hedefli zorunlu materyali sayar.
  await page.goto("/dashboard");
  const mandatory = page.locator(".metric-card").filter({ hasText: "Zorunlu materyal" });
  await expect(mandatory.locator(".metric-value")).toHaveText(/^\d+ \/ 1$/);
});
