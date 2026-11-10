import { expect, type Page } from "@playwright/test";
import { SEED_PASSWORD } from "../../scripts/fixtures/seed-data";

/**
 * Seed hesaplarıyla arayüz üzerinden giriş.
 *
 * Not: Mevcut giriş akışındaki ikinci adım sahte bir TOTP ekranıdır (AUDIT C4). F3.4'te gerçek
 * MFA'ya geçilince bu yardımcı güncellenir; o zamana kadar akışı olduğu gibi sürer.
 * N3: gönder butonu hydration tamamlanana kadar devre dışıdır; etkinleşmesi beklenir.
 */
export async function loginAs(page: Page, email: string, password: string = SEED_PASSWORD) {
  await page.goto("/login");
  const submit = page.getByRole("button", { name: "İki Aşamalı Doğrulamaya Geç" });
  await expect(submit).toBeEnabled();
  await page.getByLabel("Kurumsal Hekim E-Postası").fill(email);
  await page.getByLabel("Klinik Oturum Şifresi").fill(password);
  await submit.click();
  const totp = page.getByLabel("6 Haneli Doğrulama Kodu (Authenticator)");
  await totp.waitFor();
  await totp.fill("123456");
  await page.getByRole("button", { name: "Doğrula ve Kliniğe Giriş Yap" }).click();
}

export const ACCOUNTS = {
  admin: "egitim.sorumlusu@pediatrist.test",
  asistan2: "asistan2@pediatrist.test",
  bekleyen: "bekleyen@pediatrist.test",
} as const;
