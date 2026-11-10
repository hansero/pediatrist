import type { NextConfig } from "next";
import path from "path";

const isDev = process.env.NODE_ENV !== "production";
const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

/**
 * Content-Security-Policy direktifleri.
 *
 * Üretim değerleri F2.5'te düzeltilecek (Cloud Functions, App Check, reCAPTCHA frame'i, medya).
 * Burada yalnızca yerel geliştirme / emülatör ekleri koşullu olarak yapılır:
 * - `next dev` (React Refresh) `'unsafe-eval'` gerektirir; yalnızca geliştirmede eklenir.
 * - Emülatör modunda istemci SDK'sı 127.0.0.1 üzerindeki emülatörlere bağlanır (firebase.json).
 */
const csp: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    "https://www.gstatic.com",
    "https://apis.google.com",
    "https://www.google.com",
  ],
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  "font-src": ["'self'", "https://fonts.gstatic.com"],
  "img-src": ["'self'", "data:", "blob:", "https://firebasestorage.googleapis.com"],
  "connect-src": [
    "'self'",
    "https://*.googleapis.com",
    "https://*.firebaseio.com",
    "wss://*.firebaseio.com",
    "https://identitytoolkit.googleapis.com",
    "https://securetoken.googleapis.com",
  ],
  "frame-ancestors": ["'none'"],
};

if (isDev) {
  csp["script-src"].push("'unsafe-eval'");
}

if (useEmulators) {
  const local = ["http://127.0.0.1:*", "ws://127.0.0.1:*", "http://localhost:*", "ws://localhost:*"];
  csp["connect-src"].push(...local);
  csp["img-src"].push("http://127.0.0.1:*", "http://localhost:*");
}

const contentSecurityPolicy = Object.entries(csp)
  .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
  .join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self)",
  },
  {
    key: "Content-Security-Policy",
    value: `${contentSecurityPolicy};`,
  },
];

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
