/**
 * pdf.js çalışma zamanı varlıklarını `public/pdfjs/` altına kopyalar (F6.3):
 *  - `pdf.worker.min.mjs`: PDF ayrıştırma worker'ı (aynı kökenden; CSP `worker-src 'self'`).
 *  - `standard_fonts/`: standart 14 fontu (Helvetica vb.) kullanan PDF'lerin doğru çizilmesi için
 *    (`standardFontDataUrl`; F0.4 notu).
 * Kaynak, kurulu `pdfjs-dist` paketidir: worker sürümü API sürümüyle her zaman aynıdır. Çıktı git'e girmez;
 * `postinstall` ve `prebuild` ile üretilir.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "node_modules", "pdfjs-dist");
const out = path.join(root, "public", "pdfjs");

if (!existsSync(src)) {
  console.warn("[pdfjs] pdfjs-dist kurulu değil; varlıklar kopyalanmadı.");
  process.exit(0);
}
const { version } = JSON.parse(readFileSync(path.join(src, "package.json"), "utf8"));
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(path.join(src, "build", "pdf.worker.min.mjs"), path.join(out, "pdf.worker.min.mjs"));
cpSync(path.join(src, "standard_fonts"), path.join(out, "standard_fonts"), { recursive: true });
writeFileSync(path.join(out, "VERSION"), `${version}\n`);
console.log(`[pdfjs] ${version} worker ve standart fontlar public/pdfjs/ altına kopyalandı.`);
