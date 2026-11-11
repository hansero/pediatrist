import { expect, type BrowserContext, type CDPSession, type Page } from "@playwright/test";

/**
 * Chromium'un sanal WebAuthn doğrulayıcısı (CDP): gerçek bir telefonun yüz/parmak izi doğrulayıcısı gibi
 * davranır (platform, kullanıcı doğrulaması var, otomatik onay). F4.2 / F4.3 e2e testleri kullanır.
 */
export async function withVirtualAuthenticator(
  context: BrowserContext,
  page: Page
): Promise<{ cdp: CDPSession; id: string }> {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, id: authenticatorId };
}

/** Oturum açmış üyenin bu (sanal) cihazını yoklama cihazı olarak kaydeder. */
export async function registerDeviceViaUi(page: Page) {
  await page.goto("/account/device");
  const card = page.getByRole("region", { name: "Bu hesaba kayıtlı cihaz" });
  await page.getByRole("button", { name: "Bu cihazı kaydet" }).click();
  await expect(card.locator(".sec-chip")).toHaveText("Kayıtlı");
}
