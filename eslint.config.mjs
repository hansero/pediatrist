import { FlatCompat } from "@eslint/eslintrc";
import jsxA11y from "eslint-plugin-jsx-a11y";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

// F2.5: zod yalnızca ortak yapılandırılmış modülden alınır (Türkçe mesajlar + CSP uyumlu `jitless`).
const ZOD_IMPORT_RULE = {
  name: "zod",
  message: "zod'u `@shared/zod` (functions içinde `./shared/zod`) üzerinden import edin (REVISION_PLAN F2.5).",
};

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "functions/lib/**",
      "functions/node_modules/**",
      "next-env.d.ts",
      ".firebase/**",
      "test-results/**",
      "playwright-report/**",
      "coverage/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // eslint-config-next jsx-a11y eklentisini zaten kaydediyor; burada yalnızca
    // "recommended" kural setinin tamamını etkinleştiriyoruz (eklentiyi yeniden kaydetmeden).
    files: ["src/**/*.{ts,tsx}"],
    // Not: etiketsiz <select>/<input> denetimi statik analizle güvenilir yakalanmıyor
    // (<option> metni etiket sayılıyor); bu kontrol F8.1'de axe ile çalışma zamanında yapılır.
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  {
    files: ["functions/src/**/*.ts"],
    rules: {
      // Cloud Functions Next.js uygulaması değildir.
      "@next/next/no-assign-module-variable": "off",
      // N2: namespace API (admin.firestore.FieldValue vb.) Functions emülatöründe undefined döner.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "firebase-admin",
              message: "Modüler import kullanın: firebase-admin/app, /auth, /firestore, /storage (REVISION_PLAN N2).",
            },
            ZOD_IMPORT_RULE,
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { paths: [ZOD_IMPORT_RULE] }] },
  },
  {
    // Yapılandırmanın kendisi zod'u doğrudan alır.
    files: ["functions/src/shared/zod.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // Playwright fixture'larındaki `use(...)` bir React kancası değildir.
    files: ["e2e/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
];

export default config;
