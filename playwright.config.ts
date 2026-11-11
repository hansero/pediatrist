import { readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E testleri ÜRETİM derlemesine (next build + next start) karşı, emülatörlerle çalışır.
 * Emülatör yapılandırması `.env.development`'tan okunur (üretim derlemesi o dosyayı kendisi yüklemez),
 * böylece üretim CSP'si ('unsafe-eval' olmadan) de test edilmiş olur.
 *
 * Çalıştırma: `npm run test:e2e` (emülatörleri başlatır, seed yükler, testleri koşar).
 * Not: Tarayıcı olarak ortamdaki Chromium kullanılır (PLAYWRIGHT_BROWSERS_PATH); CI'da kurulur.
 */
const PORT = 3100;
const emulatorEnv = parseEnv(readFileSync(path.join(__dirname, ".env.development"), "utf8")) as Record<string, string>;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "masaustu", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    {
      name: "telefon",
      use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: { ...emulatorEnv, NEXT_TELEMETRY_DISABLED: "1" },
  },
});
