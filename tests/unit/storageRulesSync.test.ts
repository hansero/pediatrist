import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MATERIAL_UPLOAD, QUIZ_MEDIA_UPLOAD } from "@shared/constants";

/**
 * `storage.rules` ile ortak sabitlerin (yükleme arayüzünün kullandığı) aynı kaldığını denetler.
 * Kurallardaki `contentTypeMatches('...')` desenleri ve `sizeBelowMb(N)` değerleri okunur ve
 * gerçek içerik türleri bu desenlerle eşleştirilir.
 */
const rules = readFileSync(path.resolve(import.meta.dirname, "..", "..", "storage.rules"), "utf8");

function block(matchPath: string): string {
  const start = rules.indexOf(`match /${matchPath}`);
  expect(start, `storage.rules içinde 'match /${matchPath}' yok`).toBeGreaterThan(-1);
  return rules.slice(start, rules.indexOf("\n    }", start));
}

function rulesOf(matchPath: string) {
  const b = block(matchPath);
  const patterns = [...b.matchAll(/contentTypeMatches\('([^']+)'\)/g)].map((m) => new RegExp(`^${m[1]}$`));
  const sizes = [...b.matchAll(/sizeBelowMb\((\d+)\)/g)].map((m) => Number(m[1]));
  const allows = (type: string) => patterns.some((re) => re.test(type));
  return { patterns, sizes, allows };
}

describe("storage.rules ↔ ortak yükleme sabitleri", () => {
  it("materyaller: aynı boyut sınırı, sabitlerdeki her tür kurallarda izinli, tehlikeli türler izinsiz", () => {
    const r = rulesOf("materials/{materialId}/{fileName}");
    expect(r.sizes).toEqual([MATERIAL_UPLOAD.maxMb]);
    for (const type of Object.keys(MATERIAL_UPLOAD.contentTypes)) expect(r.allows(type), type).toBe(true);
    for (const type of [
      "image/svg+xml",
      "application/x-msdownload",
      "text/html",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]) {
      expect(r.allows(type), type).toBe(false);
    }
  });

  it("kurallar sabitlerde olmayan bir türe izin vermez (iki yönlü eşleşme)", () => {
    const r = rulesOf("materials/{materialId}/{fileName}");
    const candidates = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/ogg",
      "image/gif",
      "image/bmp",
      "image/tiff",
    ];
    for (const type of candidates) {
      expect(r.allows(type), type).toBe(type in MATERIAL_UPLOAD.contentTypes);
    }
  });

  it("sınav görselleri: aynı boyut sınırı ve aynı türler", () => {
    const r = rulesOf("quiz_media/{fileName}");
    expect(r.sizes).toEqual([QUIZ_MEDIA_UPLOAD.maxMb]);
    for (const type of QUIZ_MEDIA_UPLOAD.contentTypes) expect(r.allows(type), type).toBe(true);
    for (const type of ["image/svg+xml", "application/pdf", "image/bmp"]) expect(r.allows(type), type).toBe(false);
  });
});
