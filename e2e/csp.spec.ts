import { REGION } from "../functions/src/shared/constants";
import { expect, test, watchCsp } from "./fixtures/test";

/**
 * F2.5: Güvenlik başlıkları üretim derlemesinde gerçekten gönderiliyor ve CSP bekçisi gerçekten çalışıyor.
 * (Üretim izin listesinin içeriği `tests/unit/securityHeaders.test.ts`'te denetlenir; burada emülatör modundayız.)
 */
test("üretim derlemesi güvenlik başlıklarını gönderir", async ({ page }) => {
  const response = await page.goto("/login");
  const headers = response?.headers() ?? {};
  const csp = headers["content-security-policy"] ?? "";

  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain(`https://${REGION}-demo-pediatrist.cloudfunctions.net`);
  expect(csp).not.toContain("'unsafe-eval'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["permissions-policy"]).toContain("microphone=()");
});

test("CSP bekçisi izin listesinde olmayan bir isteği yakalar", async ({ browser }) => {
  // Bilerek ihlal üretilen bu bağlam test sonu denetimine dahil edilmez.
  const context = await browser.newContext();
  const violations = await watchCsp(context);
  const page = await context.newPage();
  await page.goto("/login", { waitUntil: "networkidle" });

  await page.evaluate(() => fetch("https://izinsiz.example.com/veri").catch(() => undefined));
  await expect.poll(() => violations.length).toBeGreaterThan(0);
  expect(violations.join("\n")).toContain("connect-src");
  await context.close();
});
