import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** WCAG 2.1 A/AA kuralları (F8.1). Hedef: ciddi (serious) ve kritik ihlal sıfır. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** Sayfa içeriği yüklenene kadar bekler: başlık görünür ve yükleniyor işaretleri kalkar. */
export async function settle(page: Page) {
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
}

/** Ciddi/kritik ihlallerin okunabilir özeti (kural · etki · örnek seçici · ilk düğümün açıklaması). */
export async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => {
      const targets = v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join(" | ");
      return `${v.id} (${v.impact}, ${v.nodes.length} öğe): ${v.help} → ${targets} :: ${v.nodes[0]?.failureSummary?.replace(/\s+/g, " ").slice(0, 220) ?? ""}`;
    });
}
