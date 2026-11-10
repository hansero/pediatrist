import { expect, test } from "@playwright/test";
import { findUserProfileByEmail } from "./fixtures/emulator";

/**
 * Kayıt akışı regresyon testi (F2.1): `users/{uid}` create kuralı sıkılaştırıldı ama kayıt ekranının
 * yazdığı biçime izin vermeli. F2.3/F3.5'te kayıt `completeRegistration` callable'ına taşınınca bu test
 * genişletilir (davet kodu, e-posta doğrulama, admin onayı sonrası otomatik geçiş).
 */
test("yeni asistan kayıt olur ve onay bekleme ekranına yönlendirilir", async ({ page }, testInfo) => {
  const email = `kayit.${testInfo.project.name}.${Date.now()}@example.test`;

  // Hydration beklenmeden gönderilen form kaybolur (REVISION_PLAN N3).
  await page.goto("/register", { waitUntil: "networkidle" });
  await page.getByLabel("Akademik / Klinik Unvan").selectOption("Asistan Dr.");
  await page.getByLabel("Pediatri Kıdem Yılı").selectOption("2");
  await page.getByLabel("Ad Soyad").fill("Deneme Asistan");
  await page.getByLabel("Kurumsal E-Posta Adresi").fill(email);
  await page.getByLabel("Oturum Şifresi (En az 8 karakter)").fill("Deneme-Sifre-2026");
  await page.getByRole("button", { name: "Üyelik Başvurusunu Eğitim Sorumlusuna Gönder" }).click();

  await expect(page).toHaveURL(/\/pending$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Onayı Bekliyor");
  // Not: sayfadaki boş role="alert" Next.js'in rota duyurucusudur (next-route-announcer), hata değildir.
  await expect(page.locator(".clinical-alert")).toHaveCount(0);

  const profile = await findUserProfileByEmail(email);
  expect(profile).toMatchObject({
    email,
    role: "user",
    status: "pending",
    title: "Asistan Dr.",
    fullName: "Deneme Asistan",
    residencyYear: 2,
  });
});
