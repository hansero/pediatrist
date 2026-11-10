import { afterEach } from "vitest";

// Vitest `globals` kapalı olduğu için Testing Library otomatik temizlik yapmaz; jsdom testlerinde DOM'u sıfırla.
afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});
