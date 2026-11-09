#!/usr/bin/env node
/**
 * "Sahte veri bekçisi" (REVISION_PLAN D1).
 *
 * `src/` ve `functions/src/` içinde mock / uydurma veri belirtilerini arar:
 *  - bilinen mock tanımlayıcıları ve uydurma kişi adları,
 *  - seed (emülatör test verisi) kimlikleri: isim ve e-postalar `scripts/fixtures/seed-data.ts`'ten okunur,
 *  - uygulama kodundan `scripts/` (fixtures) import'u,
 *  - güvenlik kodu üretiminde kullanılmaması gereken `Math.random(`.
 *
 * Mevcut ihlaller `scripts/no-mock-allowlist.json` içinde DOSYA bazında, kapatacak faz etiketiyle
 * listelenir. Liste yalnızca küçülür: listedeki bir dosya temizlenince bekçi hata verir ve dosyanın
 * listeden çıkarılmasını ister. F7.5'te liste boş olur ve dosya silinir.
 *
 * Kullanım: node scripts/check-no-mock.mjs   (npm run check:no-mock)
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const SCAN_DIRS = ["src", "functions/src"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css"]);
const ALLOWLIST_PATH = path.join(root, "scripts", "no-mock-allowlist.json");

/** Sabit desenler: [ad, RegExp]. */
const STATIC_PATTERNS = [
  ["INITIAL_* mock sabiti", /\bINITIAL_[A-Z_]+\b/],
  ["FALLBACK_* mock oturumu", /\bFALLBACK_[A-Z_]+\b/],
  ["invokeWithFallback (sessiz sahte başarı, C1)", /\binvokeWithFallback\b/],
  ["sahte uid", /\buid_(user|admin|pending)_\d+\b/],
  ["sahte oturum/sınav kimliği", /\b(att_session_|quiz_active_current|att_oct_|quiz_oct_|arch_oct_)\w*/],
  ["istemcide üretilen yoklama kodu", /\bhmacSlotCode\b/],
  ["uydurma karne (sampleGraded)", /\bsampleGraded\b/],
  ["sabit KPI değeri", /76 \/ 100/],
  ["Math.random (güvenlik kodu için crypto kullanın)", /Math\.random\(/],
  ["fixtures import'u (D1)", /from\s+["'][^"']*scripts\/fixtures[^"']*["']/],
];

/** Uygulamanın ilk sürümündeki uydurma kişiler. */
const MOCK_PEOPLE = ["Selim Kaya", "Elif Demir", "Burak Şahin", "Mert Yılmaz", "Ayşe Aksoy", "selim.kaya@"];

function seedIdentities() {
  const src = readFileSync(path.join(root, "scripts", "fixtures", "seed-data.ts"), "utf8");
  const names = [...src.matchAll(/fullName:\s*"([^"]+)"/g)].map((m) => m[1]);
  const emails = [...src.matchAll(/email:\s*"([^"]+@[^"]+)"/g)].map((m) => m[1]);
  return [...names, ...emails];
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = [
  ...STATIC_PATTERNS,
  ...MOCK_PEOPLE.map((p) => [`uydurma kişi: ${p}`, new RegExp(escape(p))]),
  ...seedIdentities().map((p) => [`seed kimliği uygulama kodunda: ${p}`, new RegExp(escape(p))]),
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(path.extname(name))) out.push(full);
  }
  return out;
}

const allowlist = existsSync(ALLOWLIST_PATH) ? JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8")) : {};
const allowed = new Map(Object.entries(allowlist).filter(([k]) => !k.startsWith("$")));

const violations = new Map(); // rel → [{line, name, text}]
for (const dir of SCAN_DIRS) {
  for (const file of walk(path.join(root, dir))) {
    const rel = path.relative(root, file).split(path.sep).join("/");
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((text, i) => {
      for (const [name, re] of patterns) {
        if (re.test(text)) {
          if (!violations.has(rel)) violations.set(rel, []);
          violations.get(rel).push({ line: i + 1, name, text: text.trim().slice(0, 100) });
        }
      }
    });
  }
}

const errors = [];
for (const [rel, hits] of violations) {
  if (allowed.has(rel)) continue;
  for (const h of hits) errors.push(`${rel}:${h.line}  ${h.name}\n      ${h.text}`);
}
for (const [rel, phase] of allowed) {
  if (!existsSync(path.join(root, rel))) {
    errors.push(`${rel}  izin listesinde ama dosya yok (${phase}) → scripts/no-mock-allowlist.json'dan çıkarın.`);
  } else if (!violations.has(rel)) {
    errors.push(`${rel}  artık temiz (${phase}) → scripts/no-mock-allowlist.json'dan çıkarın.`);
  }
}

const tolerated = [...violations.keys()].filter((k) => allowed.has(k));
if (errors.length) {
  console.error(`✖ Sahte veri bekçisi: ${errors.length} sorun\n\n${errors.join("\n")}\n`);
  process.exit(1);
}
console.log(
  `✔ Sahte veri bekçisi: izin listesi dışında ihlal yok. ` +
    `İzin listesinde ${tolerated.length} dosya kaldı (${[...new Set([...allowed.values()])].sort().join(", ") || "—"}).`
);
