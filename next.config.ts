import type { NextConfig } from "next";
import path from "path";

import { buildSecurityHeaders } from "./config/securityHeaders";

/**
 * Güvenlik başlıkları ve CSP'nin tek kaynağı `config/securityHeaders.ts` (F2.5). Firebase Hosting
 * (webframeworks) bu başlıkları Next'in derleme çıktısından alır; `firebase.json`'da kopyası yoktur.
 */
const securityHeaders = buildSecurityHeaders({
  isDev: process.env.NODE_ENV !== "production",
  useEmulators: process.env.NEXT_PUBLIC_USE_EMULATORS === "true",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
  webpack(config) {
    // `@shared` (functions/src/shared) dosyaları `zod`'u functions/node_modules'tan çözerdi; tarayıcı
    // paketine ikinci bir zod kopyası girmesin diye tek kopyaya (kök node_modules) bağlanır.
    config.resolve.alias = { ...config.resolve.alias, zod: path.join(__dirname, "node_modules", "zod") };
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
