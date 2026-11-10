import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tasarım token'larının WCAG 2.2 AA kontrastı (F3.1; AUDIT §6'daki hesap yöntemi).
 * Değerler doğrudan `src/styles/tokens.css`'ten okunur: token değişirse bu test yeniden hesaplar.
 */
const css = readFileSync(path.resolve(import.meta.dirname, "../../../src/styles/tokens.css"), "utf8");

const raw = new Map<string, string>();
for (const m of css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) raw.set(m[1], m[2].trim());

type RGB = [number, number, number];

function resolve(name: string, depth = 0): string {
  const value = raw.get(name);
  if (!value) throw new Error(`Token yok: --${name}`);
  const ref = value.match(/^var\(--([a-z0-9-]+)\)$/);
  return ref && depth < 5 ? resolve(ref[1], depth + 1) : value;
}

function rgb(name: string): RGB {
  const v = resolve(name);
  const hsl = v.match(/^hsl\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%\)$/);
  if (!hsl) throw new Error(`--${name} düz hsl() değil: ${v}`);
  const [h, s, l] = [Number(hsl[1]) / 360, Number(hsl[2]) / 100, Number(hsl[3]) / 100];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return s === 0 ? [l, l, l] : [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)];
}

function luminance([r, g, b]: RGB): number {
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(rgb(fg)), luminance(rgb(bg))];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const TEXT: Array<[string, string]> = [
  ["text-primary", "bg-surface"],
  ["text-secondary", "bg-surface"],
  ["text-secondary", "bg-surface-subtle"],
  ["text-muted", "bg-surface"],
  ["text-muted", "bg-canvas"],
  ["text-muted", "bg-surface-subtle"],
  ["clinical-primary", "bg-surface"],
  ["status-success", "status-success-bg"],
  ["status-warning", "status-warning-bg"],
  ["status-critical", "status-critical-bg"],
  ["status-info", "status-info-bg"],
  ["status-critical", "bg-surface"],
  ["text-on-accent", "clinical-primary"],
  ["text-on-accent", "clinical-primary-hover"],
  ["text-on-accent", "status-critical"],
  ["text-on-accent", "bg-sidebar-active"],
  ["text-on-dark", "bg-sidebar"],
  ["text-on-dark-muted", "bg-sidebar"],
  ["text-on-dark-muted", "bg-sidebar-hover"],
];

const NON_TEXT: Array<[string, string]> = [
  ["border-strong", "bg-surface"],
  ["focus-ring", "bg-surface"],
  ["focus-ring", "bg-canvas"],
  ["focus-ring", "bg-surface-subtle"],
  ["focus-ring-on-dark", "bg-sidebar"],
];

describe("token kontrastı (WCAG 2.2 AA)", () => {
  it.each(TEXT)("metin: --%s / --%s ≥ 4.5:1", (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT)("kontrol/odak: --%s / --%s ≥ 3:1", (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3);
  });

  it("hesaplama bilinen değerleri üretir (siyah/beyaz 21:1)", () => {
    raw.set("t-black", "hsl(0, 0%, 0%)");
    raw.set("t-white", "hsl(0, 0%, 100%)");
    expect(contrast("t-black", "t-white")).toBeCloseTo(21, 5);
  });
});

describe("token bütünlüğü", () => {
  it("stil dosyalarında ve bileşenlerde tanımsız token kullanılmıyor", async () => {
    const { globSync } = await import("node:fs");
    const root = path.resolve(import.meta.dirname, "../../..");
    const files = globSync(["src/**/*.css", "src/**/*.tsx"], { cwd: root });
    const defined = new Set(raw.keys());
    // next/font değişkenleri çalışma zamanında `<html>` üzerinde tanımlanır.
    for (const name of ["font-jakarta", "font-jetbrains"]) defined.add(name);
    const missing: string[] = [];
    for (const file of files) {
      const text = readFileSync(path.join(root, file), "utf8");
      for (const m of text.matchAll(/var\(--([a-z0-9-]+)/g)) {
        if (!defined.has(m[1])) missing.push(`${file}: --${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
