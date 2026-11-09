import { FlatCompat } from "@eslint/eslintrc";
import jsxA11y from "eslint-plugin-jsx-a11y";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

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
    },
  },
];

export default config;
