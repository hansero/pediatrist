import type { Page } from "@playwright/test";
import { createMember, createPendingMember, runMemberAction } from "./fixtures/admin";
import { ACCOUNTS, loginAs } from "./fixtures/auth";
import { closeLiveLectures, findDocIds } from "./fixtures/emulator";
import { createDraft, openStudio, publishForce } from "./fixtures/quiz";
import { REGISTRATION_PASSWORD } from "./fixtures/registration";
import { expect, expectNoHorizontalOverflow, guardedContext, test } from "./fixtures/test";

/**
 * F7.3: durum odaklı ana sayfa. Ana kart gerçek duruma göre TEK eylem önerir ve durum değiştikçe (admin başka
 * tarayıcıda ders başlatınca, mazeret girince, sınavı kapatınca) sayfa yenilenmeden güncellenir.
 * Göstergeler sunucu sayımıdır; test beklenen değeri emülatörden okur (sabit sayı yok).
 */
const SEPSIS = "Pediatrik Septik Şok: İlk Saat Yönetimi";

const kpi = (page: Page, label: string) => page.locator(".metric-card").filter({ hasText: label });
const step = (page: Page, title: string | RegExp) => page.getByRole("region", { name: title });

test("hekim: yayındaki sınav → canlı ders → mazeret → zorunlu materyal; göstergeler boş durumda dürüst", async ({
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  await closeLiveLectures();
  const stamp = Date.now();
  const fullName = `Gösterge Asistanı ${stamp % 100_000}`;
  const email = `gosterge.${testInfo.project.name}.${stamp}@example.test`;
  await createMember(email, fullName, { status: "active", residencyYear: 3 });
  const quizTitle = `Ana sayfa sınavı ${testInfo.project.name} ${stamp}`;
  const lectureTitle = `Ana sayfa dersi ${testInfo.project.name} ${stamp}`;

  // Admin: sınavı yayınlar (varsa önceki yayındaki sınav kapanır).
  const adminCtx = await guardedContext(await browser.newContext());
  const admin = await adminCtx.newPage();
  await openStudio(admin);
  await createDraft(admin, quizTitle, "Sınav kapanınca (önerilen)");
  await publishForce(admin, quizTitle);

  // Hekim: ana kart yayındaki sınavı önerir; yeni hekimin göstergeleri uydurma değil, boş durum.
  const doctorCtx = await guardedContext(await browser.newContext());
  const doctor = await doctorCtx.newPage();
  await loginAs(doctor, email, REGISTRATION_PASSWORD);
  await expect(doctor).toHaveURL(/\/dashboard$/);
  await expect(doctor.getByRole("heading", { level: 1 })).toContainText(fullName);
  const quizStep = step(doctor, `Yayında sınav: ${quizTitle}`);
  await expect(quizStep).toContainText("3 soru · 15 dakika");
  await expect(quizStep.getByRole("link", { name: "Sınava git" })).toHaveAttribute("href", "/quizzes");
  await expect(kpi(doctor, "Sınav ortalaması")).toContainText("Henüz puanlanmış sınavınız yok.");
  await expect(kpi(doctor, "Derse katılım")).toContainText("Henüz kapanmış ders kaydınız yok.");
  await expect(kpi(doctor, "Zorunlu materyal").locator(".metric-value")).toHaveText(/^0 \/ \d+$/);
  await expectNoHorizontalOverflow(doctor);

  // Admin dersi başlatır → hekimin ana kartı yenilenmeden yoklamayı önerir (ders sınavdan önceliklidir).
  await admin.goto("/attendance");
  await admin.getByLabel("Ders başlığı").fill(lectureTitle);
  await admin.getByLabel("Yoklama süresi (dakika)").fill("10");
  await admin.getByRole("button", { name: "Yoklamayı başlat" }).click();
  const liveCard = admin.getByRole("region", { name: lectureTitle });
  await expect(liveCard.getByText("Yoklama açık")).toBeVisible();
  const lectureStep = step(doctor, `Canlı ders: ${lectureTitle}`);
  await expect(lectureStep.getByRole("link", { name: "Yoklamaya katıl" })).toHaveAttribute("href", "/attendance");

  // Admin mazeret girer → hekimin kaydı oluşur; ana kart sıradaki işe (sınav) döner.
  await admin.getByRole("button", { name: new RegExp(`${fullName}: mazeret gir$`) }).click();
  const excuse = admin.getByRole("dialog", { name: "Mazeret gir" });
  await excuse.getByLabel("Mazeret notu").fill("Poliklinik");
  await excuse.getByRole("button", { name: "Kaydet" }).click();
  await expect(excuse).toHaveCount(0);
  await expect(
    doctor.getByRole("status").filter({ hasText: `${lectureTitle} dersine katılımınız kaydedildi (mazeretli).` })
  ).toBeVisible();
  await expect(quizStep).toBeVisible();

  // Admin dersi bitirir ve sınavı kapatır → sırada zorunlu materyal (kıdeme yönelik, en eski).
  await liveCard.getByRole("button", { name: "Dersi bitir" }).click();
  await admin
    .getByRole("alertdialog", { name: "Ders yoklamasını bitir" })
    .getByRole("button", { name: "Dersi bitir" })
    .click();
  await expect(admin.getByRole("button", { name: "Yoklamayı başlat" })).toBeVisible();
  await admin.goto("/quizzes");
  await admin.getByRole("region", { name: quizTitle }).getByRole("button", { name: "Sınavı kapat" }).click();
  await admin.getByRole("alertdialog", { name: "Sınavı kapat" }).getByRole("button", { name: "Sınavı kapat" }).click();
  await expect(admin.getByRole("status").filter({ hasText: "Sınav kapatıldı." })).toBeVisible();

  const materialStep = step(doctor, `Zorunlu materyal: ${SEPSIS}`);
  await expect(materialStep).toBeVisible({ timeout: 15_000 });
  await expect(doctor.getByRole("status").filter({ hasText: "katılımınız kaydedildi" })).toHaveCount(0);

  // "Materyali aç" doğrudan görüntüleyiciyi açar; listeye dönünce bağlantı parametresi silinir.
  const [materialId] = await findDocIds("materials", "title", SEPSIS);
  await materialStep.getByRole("link", { name: "Materyali aç" }).click();
  await expect(doctor).toHaveURL(new RegExp(`/materials\\?materyal=${materialId}$`));
  const viewer = doctor.getByRole("region", { name: SEPSIS, exact: true });
  await expect(viewer).toBeVisible();
  await viewer.getByRole("button", { name: "Listeye dön" }).click();
  await expect(doctor).toHaveURL(/\/materials$/);
  await expect(doctor.getByRole("heading", { level: 1, name: "Eğitim materyalleri" })).toBeVisible();

  await doctorCtx.close();
  await adminCtx.close();
});

test("admin: onay bekleyen başvurular ana kartta; göstergeler sunucu sayımı ve yenilenir", async ({
  page,
}, testInfo) => {
  await closeLiveLectures();
  const email = `bekleyen.gosterge.${testInfo.project.name}.${Date.now()}@example.test`;
  await createPendingMember(email, "Gösterge Başvurusu");
  const pending = (await findDocIds("users", "status", "pending")).length;
  expect(pending).toBeGreaterThan(0);

  await loginAs(page, ACCOUNTS.admin);
  await expect(page).toHaveURL(/\/dashboard$/);
  const pendingStep = step(page, `${pending} başvuru onay bekliyor`);
  await expect(pendingStep.getByRole("link", { name: "Başvuruları incele" })).toHaveAttribute("href", "/admin");
  await expect(kpi(page, "Onay bekleyen başvuru").locator(".metric-value")).toHaveText(String(pending));
  // Seed'de ve önceki testlerde kapanmış dersler var: oran sunucuda ders sayaçlarından hesaplanır.
  await expect(kpi(page, "Son 30 gün katılım").locator(".metric-value")).toHaveText(/^%\d{1,3}$/);
  await expect(kpi(page, "Son 30 gün katılım")).toContainText("mazeretliler hariç");
  await expect(kpi(page, "Yayındaki sınav")).toContainText("Yayında sınav yok.");
  await expectNoHorizontalOverflow(page);

  // Başvuru onaylanınca "Göstergeleri yenile" yeni sunucu sayımını getirir.
  await pendingStep.getByRole("link", { name: "Başvuruları incele" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await runMemberAction(page, email, "Üyeliği onayla", "Onayla", "Gösterge Başvurusu onaylandı.");
  await page.goto("/dashboard");
  const value = kpi(page, "Onay bekleyen başvuru").locator(".metric-value");
  await expect(value).toHaveText(String(pending - 1));
  await page.getByRole("button", { name: "Göstergeleri yenile" }).click();
  await expect(value).toHaveText(String(pending - 1));
});
