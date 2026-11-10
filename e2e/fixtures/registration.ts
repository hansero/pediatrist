import { expect, type Page } from "@playwright/test";

export const REGISTRATION_PASSWORD = "Deneme-Sifre-2026";

/** Kayıt formunu doldurup gönderir (F2.3 akışı: Auth hesabı → completeRegistration). */
export async function fillRegistration(page: Page, email: string, inviteCode = "", fullName = "Deneme Asistan") {
  await page.goto("/register");
  // N3: gönder butonu hydration tamamlanana kadar devre dışı; etkinleşmesi formun hazır olduğunu gösterir.
  const submit = page.getByRole("button", { name: "Üyelik Başvurusunu Eğitim Sorumlusuna Gönder" });
  await expect(submit).toBeEnabled();
  await page.getByLabel("Akademik / Klinik Unvan").selectOption("Asistan Dr.");
  await page.getByLabel("Pediatri Kıdem Yılı").selectOption("2");
  await page.getByLabel("Ad Soyad").fill(fullName);
  await page.getByLabel("Kurumsal E-Posta Adresi").fill(email);
  await page.getByLabel("Oturum Şifresi (En az 8 karakter)").fill(REGISTRATION_PASSWORD);
  if (inviteCode) await page.getByLabel("Klinik Davet Kodu (Varsa)").fill(inviteCode);
  await submit.click();
}
