/**
 * `scripts/fixtures/quiz-ornek.csv` dosyasını üretir (tek seferlik; çıktı repoda tutulur).
 * İçerik, eskiden `src/app/(protected)/quizzes/page.tsx` içinde sabit duran örnek sorulardır
 * (F5'te o dosyadan silinecek). F5.1 seed'i ve F5.5 e2e admin CSV yükleme testi bu dosyayı kullanır.
 *
 * Çalıştırma: npx tsx scripts/fixtures/build-quiz-csv.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { NINE_FIELD_CSV_HEADERS, parseNineFieldQuizCsv } from "../../src/lib/quiz-parser";

type Row = [string, string, string, string, string, string, string[], string[], string];

const rows: Row[] = [
  [
    "2.5 yaşında erkek hasta; 6 gündür süren 39.5°C ateş, bilateral eksüdasız konjonktival hiperemi, çilek dili, servikal 2x2 cm lenfadenopati ve el-ayak sırtında ödem ile başvuruyor.",
    "",
    "Bu hastada koroner arter anevrizması gelişimini önlemek için ilk basamak spesifik tedavi kombinasyonu nedir?",
    "Single Choice",
    "",
    "",
    [
      "Tek doz 2 g/kg IVIG + Aspirin (ASA)",
      "Yalnızca yüksek doz Metilprednizolon",
      "10 gün İntravenöz Seftriakson",
      "Tek başına İbuprofen",
    ],
    ["Tek doz 2 g/kg IVIG + Aspirin (ASA)"],
    "Tam (klasik) Kawasaki hastalığında ilk 10 gün içinde 2 g/kg tek doz IVIG ve ASA, koroner arter anevrizması oranını yaklaşık %25'ten %4'ün altına indirir.",
  ],
  [
    "8 aylık süt çocuğu; 2 gündür kusma ve sulu ishal sonrası acil servise getiriliyor. Letarjik, göz küreleri çökük, kapiller dolum zamanı 4 saniye, taşikardik ve cilt turgoru ileri derecede azalmış.",
    "",
    "Ağır dehidratasyon ve hipovolemik şok bulguları olan bu hastada ilk saat içinde uygulanması gereken doğru yaklaşımları seçiniz.",
    "Multiple Choice",
    "",
    "",
    [
      "20 mL/kg %0.9 NaCl (izotonik kristalloid) hızlı IV bolus",
      "Damar yolu 90 sn'de açılamazsa intraosseöz (IO) erişim",
      "İlk basamakta %5 dekstroz hipotonik sıvı yüklemesi",
      "Bolus sonrası perfüzyon ve karaciğer boyutunun yeniden değerlendirilmesi",
    ],
    [
      "20 mL/kg %0.9 NaCl (izotonik kristalloid) hızlı IV bolus",
      "Damar yolu 90 sn'de açılamazsa intraosseöz (IO) erişim",
      "Bolus sonrası perfüzyon ve karaciğer boyutunun yeniden değerlendirilmesi",
    ],
    "Dekompanse hipovolemik şokta 20 mL/kg izotonik kristalloid 5–20 dakikada verilir. Hipotonik sıvılar intravasküler hacmi doldurmaz ve akut hiponatremi/beyin ödemine yol açabilir.",
  ],
  [
    "5 yaşında çocuk hasta; havlar tarzda öksürük, ses kısıklığı ve inspiratuar stridor ile acil servise başvuruyor. AP boyun grafisinde subglottik daralma ('kalem ucu' görünümü) saptanıyor.",
    "quiz_media/steeple_sign.png",
    "Bu klinik tabloya neden olan en olası tanıyı yazınız.",
    "Text Input",
    "40",
    "",
    [],
    ["Krup", "Viral krup", "Akut laringotrakeobronşit", "Laringotrakeit"],
    "Havlar tarzda öksürük, inspiratuar stridor ve subglottik daralma (steeple sign) viral krup için tipiktir. Tedavide tek doz 0.15–0.6 mg/kg deksametazon temel taştır.",
  ],
];

const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
const lines = [
  NINE_FIELD_CSV_HEADERS.map(q).join(","),
  ...rows.map(([a, b, c, d, e, f, g, h, i]) =>
    [a, b, c, d, e, f, g.length ? JSON.stringify(g) : "", JSON.stringify(h), i].map(q).join(",")
  ),
];
const csv = "﻿" + lines.join("\n") + "\n";

const parsed = parseNineFieldQuizCsv(csv);
if (parsed.errors.length || parsed.questions.length !== rows.length) {
  console.error("Fixture CSV geçersiz:", parsed.errors);
  process.exit(1);
}

const out = path.join(import.meta.dirname, "quiz-ornek.csv");
writeFileSync(out, csv, "utf8");
console.log(`Yazıldı: ${path.relative(process.cwd(), out)} (${parsed.questions.length} soru, 0 hata)`);
