import { expect, type Page } from "@playwright/test";
import { SEED_PASSWORD } from "../../scripts/fixtures/seed-data";

/**
 * Seed hesaplarıyla arayüz üzerinden giriş (F3.4: sahte TOTP adımı kaldırıldı).
 * Emülatör TOTP'yi desteklemediği için seed `config/security.requireMfa=false` yazar (N8, D5);
 * MFA akışı birim testlerinde ve staging'de sınanır.
 * N3: gönder butonu hydration tamamlanana kadar devre dışıdır; etkinleşmesi beklenir.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string = SEED_PASSWORD,
  { expectSuccess = true }: { expectSuccess?: boolean } = {}
) {
  await page.goto("/login");
  const submit = page.getByRole("button", { name: "Giriş yap" });
  await expect(submit).toBeEnabled();
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill(password);
  await submit.click();
  // Başarılı girişte tam sayfa geçişi olur; çağıran test giriş sayfasında kalmış olmamalı.
  if (expectSuccess) await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export const ACCOUNTS = {
  admin: "egitim.sorumlusu@pediatrist.test",
  asistan2: "asistan2@pediatrist.test",
  bekleyen: "bekleyen@pediatrist.test",
} as const;
