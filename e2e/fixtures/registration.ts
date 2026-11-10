import { expect, type Page } from "@playwright/test";

export const REGISTRATION_PASSWORD = "Deneme-Sifre-2026";
export const REGISTER_BUTTON = "Başvuruyu gönder";

export interface RegistrationOptions {
  inviteCode?: string;
  fullName?: string;
  title?: "Asistan Dr." | "Uzm. Dr." | "Doç. Dr." | "Prof. Dr.";
  /** KVKK aydınlatma onayı (varsayılan: işaretli). */
  consent?: boolean;
}

/** Kayıt formunu doldurup gönderir (F3.5: KVKK onayı, şifre tekrarı, kıdem yalnızca asistan için). */
export async function fillRegistration(page: Page, email: string, options: RegistrationOptions = {}) {
  const { inviteCode = "", fullName = "Deneme Asistan", title = "Asistan Dr.", consent = true } = options;
  await page.goto("/register");
  // N3: gönder butonu hydration tamamlanana kadar devre dışı; etkinleşmesi formun hazır olduğunu gösterir.
  const submit = page.getByRole("button", { name: REGISTER_BUTTON });
  await expect(submit).toBeEnabled();
  await page.getByLabel("Ünvan").selectOption(title);
  if (title === "Asistan Dr.") await page.getByLabel("Kıdem yılı").selectOption("2");
  await page.getByLabel("Ad soyad").fill(fullName);
  await page.getByLabel("E-posta").fill(email);
  // "Şifre (tekrar)" ile karışmasın; zorunlu alan işareti (*) etiket metnine dahil.
  await page.getByLabel(/^Şifre(\s*\*)?$/).fill(REGISTRATION_PASSWORD);
  await page.getByLabel("Şifre (tekrar)").fill(REGISTRATION_PASSWORD);
  if (inviteCode) await page.getByLabel("Davet kodu").fill(inviteCode);
  if (consent) await page.getByRole("checkbox", { name: /aydınlatma metnini okudum/ }).check();
  await submit.click();
}
