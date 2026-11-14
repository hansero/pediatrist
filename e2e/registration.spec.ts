import { expect, test } from "./fixtures/test";
import { fillRegistration, REGISTER_BUTTON } from "./fixtures/registration";
import { applyOobCode, findUserProfileByEmail, listOobCodes, readDocument, writeDocument } from "./fixtures/emulator";
import { KVKK_NOTICE_VERSION } from "../functions/src/shared/consent";

/**
 * Kayıt akışı (F2.3): hesap Auth'ta açılır, profil sunucuda `completeRegistration` ile yazılır.
 * İstemci `users` dokümanı yazamaz (firestore.rules). F3.5: KVKK onayı (sürümle saklanır), doğrulama e-postası,
 * korumalı alandaki canlı bekleme ekranı, kıdem yılı yalnızca asistan için.
 */
test("davetsiz başvuru: profil sunucuda 'onay bekliyor' olarak oluşur", async ({ page }, testInfo) => {
  const email = `kayit.${testInfo.project.name}.${Date.now()}@example.test`;
  await fillRegistration(page, email);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Başvurunuz onay bekliyor");
  // Not: sayfadaki boş role="alert" Next.js'in rota duyurucusudur (next-route-announcer), hata değildir.
  await expect(page.locator(".clinical-alert.critical")).toHaveCount(0);
  // Doğrulama e-postası gönderildi ve bekleme ekranı doğrulamayı istiyor.
  await expect
    .poll(async () => (await listOobCodes()).some((c) => c.email === email && c.requestType === "VERIFY_EMAIL"))
    .toBe(true);
  await expect(page.getByRole("button", { name: "Doğrulama e-postası gönder" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Çıkış yap" })).toBeVisible();
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

  await fillRegistration(page, email, { inviteCode: code.toLowerCase() });

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Deneme Asistan");
  expect(await findUserProfileByEmail(email)).toMatchObject({ status: "active", role: "user", residencyYear: 3 });
  expect(await readDocument(`invitations/${code}`)).toMatchObject({ used: true });
});

test("geçersiz davet kodu: Türkçe hata gösterilir; kodsuz yeniden deneme hesabı tekrar açmadan tamamlanır", async ({
  page,
}, testInfo) => {
  const email = `hatali.${testInfo.project.name}.${Date.now()}@example.test`;
  await fillRegistration(page, email, { inviteCode: "PED-YOKBOYLE" });

  const alert = page.locator(".clinical-alert");
  await expect(alert).toContainText("Davet kodu geçersiz");
  expect(await findUserProfileByEmail(email)).toBeNull();

  // Aynı oturumda kodu silip tekrar gönder: hesap zaten açık, yalnızca profil tamamlanmalı.
  await page.getByLabel("Davet kodu").fill("");
  await page.getByRole("button", { name: REGISTER_BUTTON }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await findUserProfileByEmail(email)).toMatchObject({ status: "pending" });
});

test("KVKK onayı ve şifre tekrarı olmadan başvuru gönderilmez; hesap açılmaz", async ({ page }, testInfo) => {
  const email = `onaysiz.${testInfo.project.name}.${Date.now()}@example.test`;
  await fillRegistration(page, email, { consent: false });
  await expect(page.getByText("aydınlatma metnini okuduğunuzu onaylayın")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /aydınlatma metnini okudum/ })).toHaveAttribute(
    "aria-invalid",
    "true"
  );

  await page.getByLabel("Şifre (tekrar)").fill("Baska-Sifre-2026");
  await page.getByRole("button", { name: REGISTER_BUTTON }).click();
  await expect(page.getByText("Şifreler aynı değil.")).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
  expect(await findUserProfileByEmail(email)).toBeNull();
  expect((await listOobCodes()).some((c) => c.email === email)).toBe(false);
});

test("aydınlatma metni: sürümlü, veri sorumlusu yapılandırmadan; kayıt formundan bağlantı", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("link", { name: "KVKK aydınlatma metnini" })).toHaveAttribute("href", "/kvkk");
  await page.goto("/kvkk");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kişisel Verilerin Korunması Aydınlatma Metni");
  await expect(page.getByText(`Sürüm ${KVKK_NOTICE_VERSION}`)).toBeVisible();
  // D23 / D28: yoklamada cihaz bağlama ve kamera yok; metinde bu maddeler bulunmaz.
  await expect(page.getByText(/Cihaz bilgisi/)).toHaveCount(0);
  await expect(page.getByText(/Kamera/)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Veri sorumlusu" })).toContainText("Pediatrist Yerel Test Ortamı");
  await expect(page.getByRole("region", { name: "Haklarınız (KVKK md. 11)" })).toBeVisible();
});

test("uzman hekim başvurusu: kıdem yılı sorulmaz, profilde boş", async ({ page }, testInfo) => {
  const email = `uzman.${testInfo.project.name}.${Date.now()}@example.test`;
  await page.goto("/register");
  await expect(page.getByRole("button", { name: REGISTER_BUTTON })).toBeEnabled();
  await page.getByLabel("Ünvan").selectOption("Uzm. Dr.");
  await expect(page.getByLabel("Kıdem yılı")).toHaveCount(0);

  await fillRegistration(page, email, { title: "Uzm. Dr.", fullName: "Deneme Uzman" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Başvurunuz onay bekliyor");
  const profile = await findUserProfileByEmail(email);
  expect(profile).toMatchObject({ title: "Uzm. Dr.", residencyYear: null, status: "pending" });
});

test.describe("e-posta doğrulaması zorunlu ortam (config/security.requireEmailVerified = true, D21)", () => {
  test.afterEach(async () => {
    await writeDocument("config/security", { requireMfa: false, requireEmailVerified: false });
  });

  test("davetle etkinleşen ama e-postası doğrulanmamış üye doğrulama ekranında kalır; bağlantıyı açıp 'Doğruladım' deyince panel açılır", async ({
    page,
  }, testInfo) => {
    await writeDocument("config/security", { requireMfa: false, requireEmailVerified: true });
    const stamp = `${testInfo.project.name.toUpperCase()}-${Date.now()}`;
    const email = `dogrula.${stamp.toLowerCase()}@example.test`;
    const code = `PED-EV-${stamp}`.replace(/[^A-Z0-9-]/g, "");
    await writeDocument(`invitations/${code}`, {
      code,
      email,
      intendedRole: "user",
      residencyYear: 2,
      invitedBy: "seed-admin",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
      used: false,
      revoked: false,
    });

    await fillRegistration(page, email, { inviteCode: code });
    await expect(page.getByRole("heading", { name: "E-posta adresinizi doğrulayın" })).toBeVisible();
    expect(await findUserProfileByEmail(email)).toMatchObject({ status: "active" });

    // Kullanıcı e-postadaki bağlantıyı açar.
    let oob: { oobCode?: string } | undefined;
    await expect
      .poll(async () => {
        const all = (await listOobCodes()) as Array<{ email: string; requestType: string; oobCode?: string }>;
        oob = all.find((c) => c.email === email && c.requestType === "VERIFY_EMAIL");
        return Boolean(oob);
      })
      .toBe(true);
    await applyOobCode(String(oob?.oobCode));

    await page.getByRole("button", { name: "Doğruladım" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Deneme Asistan", { timeout: 15_000 });
  });
});
