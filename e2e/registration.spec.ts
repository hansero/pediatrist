import { expect, test, type Page } from "@playwright/test";
import { findUserProfileByEmail, readDocument, writeDocument } from "./fixtures/emulator";

/**
 * Kayıt akışı (F2.3): hesap Auth'ta açılır, profil sunucuda `completeRegistration` ile yazılır.
 * İstemci `users` dokümanı yazamaz (firestore.rules). F3.5'te KVKK onayı ve e-posta doğrulamasıyla genişler.
 */
async function fillRegistration(page: Page, email: string, inviteCode = "") {
  // Hydration beklenmeden gönderilen form kaybolur (REVISION_PLAN N3).
  await page.goto("/register", { waitUntil: "networkidle" });
  await page.getByLabel("Akademik / Klinik Unvan").selectOption("Asistan Dr.");
  await page.getByLabel("Pediatri Kıdem Yılı").selectOption("2");
  await page.getByLabel("Ad Soyad").fill("Deneme Asistan");
  await page.getByLabel("Kurumsal E-Posta Adresi").fill(email);
  await page.getByLabel("Oturum Şifresi (En az 8 karakter)").fill("Deneme-Sifre-2026");
  if (inviteCode) await page.getByLabel("Klinik Davet Kodu (Varsa)").fill(inviteCode);
  await page.getByRole("button", { name: "Üyelik Başvurusunu Eğitim Sorumlusuna Gönder" }).click();
}

test("davetsiz başvuru: profil sunucuda 'onay bekliyor' olarak oluşur", async ({ page }, testInfo) => {
  const email = `kayit.${testInfo.project.name}.${Date.now()}@example.test`;
  await fillRegistration(page, email);

  await expect(page).toHaveURL(/\/pending$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Onayı Bekliyor");
  // Not: sayfadaki boş role="alert" Next.js'in rota duyurucusudur (next-route-announcer), hata değildir.
  await expect(page.locator(".clinical-alert")).toHaveCount(0);
  expect(await findUserProfileByEmail(email)).toMatchObject({
    email,
    role: "user",
    status: "pending",
    title: "Asistan Dr.",
    fullName: "Deneme Asistan",
    residencyYear: 2,
  });
});

test("geçerli davet koduyla başvuru: üyelik doğrudan aktif, panele yönlendirilir, davet tüketilir", async ({
  page,
}, testInfo) => {
  const stamp = `${testInfo.project.name.toUpperCase()}-${Date.now()}`;
  const email = `davetli.${stamp.toLowerCase()}@example.test`;
  const code = `PED-E2E-${stamp}`.replace(/[^A-Z0-9-]/g, "");
  await writeDocument(`invitations/${code}`, {
    code,
    email,
    intendedRole: "user",
    residencyYear: 3,
    invitedBy: "seed-admin",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86_400_000),
    used: false,
    revoked: false,
  });

  await fillRegistration(page, email, code.toLowerCase());

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Deneme Asistan");
  expect(await findUserProfileByEmail(email)).toMatchObject({ status: "active", role: "user", residencyYear: 3 });
  expect(await readDocument(`invitations/${code}`)).toMatchObject({ used: true });
});

test("geçersiz davet kodu: Türkçe hata gösterilir; kodsuz yeniden deneme hesabı tekrar açmadan tamamlanır", async ({
  page,
}, testInfo) => {
  const email = `hatali.${testInfo.project.name}.${Date.now()}@example.test`;
  await fillRegistration(page, email, "PED-YOKBOYLE");

  const alert = page.locator(".clinical-alert");
  await expect(alert).toContainText("Davet kodu geçersiz");
  expect(await findUserProfileByEmail(email)).toBeNull();

  // Aynı oturumda kodu silip tekrar gönder: hesap zaten açık, yalnızca profil tamamlanmalı.
  await page.getByLabel("Klinik Davet Kodu (Varsa)").fill("");
  await page.getByRole("button", { name: "Üyelik Başvurusunu Eğitim Sorumlusuna Gönder" }).click();
  await expect(page).toHaveURL(/\/pending$/);
  expect(await findUserProfileByEmail(email)).toMatchObject({ status: "pending" });
});
