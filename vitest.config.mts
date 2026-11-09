import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(import.meta.dirname, "src"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
        },
      },
      // F0.5: "rules" (Firestore/Storage kuralları, emülatör) ve
      // "functions" (callable .run() testleri, emülatör) projeleri eklenecek.
    ],
  },
});
