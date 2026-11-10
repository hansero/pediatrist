import path from "node:path";
import { defineConfig } from "vitest/config";

const shared = path.resolve(import.meta.dirname, "functions/src/shared");
const alias = [
  { find: /^@shared$/, replacement: path.join(shared, "index.ts") },
  { find: /^@shared\/(.*)$/, replacement: `${shared}/$1` },
  { find: /^@\/(.*)$/, replacement: `${path.resolve(import.meta.dirname, "src")}/$1` },
];

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        // tsconfig `jsx: "preserve"` (Next derler); bileşen testleri için React 19 otomatik çalışma zamanı.
        oxc: { jsx: { runtime: "automatic" } },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          setupFiles: ["tests/unit/setup.ts"],
        },
      },
      {
        // Emülatör gerektirir: npm run test:rules
        resolve: { alias },
        test: {
          name: "rules",
          environment: "node",
          include: ["tests/rules/**/*.test.ts"],
          // Dosyalar aynı emülatör projesini paylaşır; sıralı çalışmalı.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
      {
        // Emülatör gerektirir: npm run test:functions
        // Testler functions/ altında durur ki firebase-admin/functions, functions kodunun
        // kullandığı AYNI kopyadan (functions/node_modules) çözülsün.
        resolve: { alias },
        test: {
          name: "functions",
          environment: "node",
          include: ["functions/test/**/*.test.ts"],
          setupFiles: ["functions/test/setup.ts"],
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
