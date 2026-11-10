import { expect, test as base, type BrowserContext } from "@playwright/test";

/**
 * Bütün e2e testlerinin ortak `test` nesnesi (F2.5): her tarayıcı bağlamında CSP ihlallerini toplar ve
 * test sonunda ihlal varsa testi düşürür. Böylece CSP'ye eklenmemiş bir uç nokta (ör. yeni bir Firebase
 * servisi) sessizce bozulmak yerine e2e'de yakalanır.
 *
 * Testin kendisinin açtığı ek bağlamlar (`browser.newContext()`) için `watchCsp(context)` çağrılmalıdır.
 */
const VIOLATION_TAG = "[csp-violation]";
const watched = new WeakMap<BrowserContext, string[]>();

export async function watchCsp(context: BrowserContext): Promise<string[]> {
  const existing = watched.get(context);
  if (existing) return existing;
  const violations: string[] = [];
  watched.set(context, violations);
  await context.addInitScript((tag) => {
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(`${tag} ${e.effectiveDirective} ${e.blockedURI || "(inline)"} @ ${e.sourceFile || e.documentURI}`);
    });
  }, VIOLATION_TAG);
  context.on("console", (msg) => {
    const text = msg.text();
    if (text.startsWith(VIOLATION_TAG) || text.includes("Content Security Policy")) violations.push(text);
  });
  return violations;
}

const contexts: BrowserContext[] = [];

export const test = base.extend<{ cspGuard: void }>({
  context: async ({ context }, use) => {
    await watchCsp(context);
    await use(context);
  },
  cspGuard: [
    async ({ context }, use) => {
      contexts.length = 0;
      contexts.push(context);
      await use();
      const all = contexts.flatMap((c) => watched.get(c) ?? []);
      expect(all, "CSP ihlali").toEqual([]);
    },
    { auto: true },
  ],
});

/** `watchCsp` ile izlenen ek bağlamları test sonu denetimine dahil eder. */
export async function guardedContext(context: BrowserContext): Promise<BrowserContext> {
  await watchCsp(context);
  contexts.push(context);
  return context;
}

export { expect };
