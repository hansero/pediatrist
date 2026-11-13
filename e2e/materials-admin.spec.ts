import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { ACCOUNTS, loginAs } from "./fixtures/auth";
import { findDocIds, writeDocument } from "./fixtures/emulator";
import { expect, expectNoHorizontalOverflow, test } from "./fixtures/test";

/**
 * F6.2: admin materyal yönetimi gerçek callable'lar ve Storage ile. Seed: 2 yayında PDF (gerçek callable'larla).
 */
const PDF = readFileSync(path.join(__dirname, "..", "scripts", "fixtures", "files", "septik-sok-ilk-saat.pdf"));
const SEPSIS = "Pediatrik Septik Şok: İlk Saat Yönetimi";
const PRETERM = "Doğumhanede Preterm Yenidoğan Stabilizasyonu";

async function openMaterials(page: Page) {
  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/materials");
  await expect(page.getByRole("heading", { level: 1, name: "Materyal yönetimi" })).toBeVisible();
}
const row = (page: Page, title: string) =>
  page.getByRole("table", { name: "Materyal listesi" }).getByRole("row").filter({ hasText: title });

test("liste ve okunma raporu: hedef kitle, canlı ilerleme ve CSV (F6.2)", async ({ page }) => {
  await openMaterials(page);
  await expect(row(page, SEPSIS)).toContainText("Yayında");
  await expect(row(page, SEPSIS)).toContainText("Zorunlu");
  await expect(row(page, PRETERM)).toContainText("1. yıl, 2. yıl");
  await expect(row(page, SEPSIS)).toContainText("Çocuk Acil, Yoğun Bakım");
  await expectNoHorizontalOverflow(page);

  await row(page, SEPSIS)
    .getByRole("button", { name: `${SEPSIS}: okunma raporu` })
    .click();
  const report = page.getByRole("region", { name: `${SEPSIS}: okunma raporu` });
  const readers = report.getByRole("table");
  const selin = readers.getByRole("row").filter({ hasText: "Selin Ateş" });
  // Okunma kaydı test hazırlığı olarak yazılır (hekim görüntüleyicisi F6.3'te); rapor canlı güncellenir.
  const [materialId] = await findDocIds("materials", "title", SEPSIS);
  await writeDocument(`materials/${materialId}/progress/seed-asistan-2`, {
    uid: "seed-asistan-2",
    secondsSpent: 600,
    lastPage: 3,
    completed: true,
    updatedAt: new Date(),
  });
  await expect(selin).toContainText("Tamamladı");
  await expect(selin).toContainText("10 dk");
  await expect(readers.getByRole("row").filter({ hasText: "Zeynep Ergin" })).toContainText("Başlamadı");
  // "Uzman" hedefli materyalde (D26) etkin Uzm. Dr. hedef kitlededir.
  await expect(report).toContainText("Hedef kitle: 1. yıl, 2. yıl, 3. yıl, 4. yıl, Uzman");
  const uzman = readers.getByRole("row").filter({ hasText: "Deniz Arıkan" });
  await expect(uzman).toContainText("Uzman");
  await expect(uzman).toContainText("Başlamadı");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    report.getByRole("button", { name: "Okunma raporunu CSV olarak indir" }).click(),
  ]);
  const lines = readFileSync((await download.path())!, "utf8")
    .replace(/^﻿/, "")
    .trimEnd()
    .split("\r\n");
  expect(lines[0]).toBe("Materyal;Hekim;Kıdem;Hedef kitlede;Durum;Süre (dk);Son sayfa");
  expect(lines).toContain(`${SEPSIS};Asistan Dr. Selin Ateş;2. yıl;Evet;Tamamladı;10;3`);
});

test("yükle (ilerleme, sunucu doğrulaması) → düzenle → sil; izinsiz tür reddedilir (F6.2)", async ({
  page,
}, testInfo) => {
  const title = `E2E materyal ${testInfo.project.name} ${Date.now()}`;
  await openMaterials(page);
  await page.getByRole("button", { name: "Materyal yükle" }).click();

  // İzinsiz tür (pptx): istemci reddeder, yükleme başlamaz.
  const file = page.getByLabel("Dosya");
  await file.setInputFiles({
    name: "sunum.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: Buffer.from("pptx"),
  });
  await expect(page.getByText("Sunumları PDF olarak kaydedip yükleyin.").last()).toBeVisible();

  await file.setInputFiles({ name: "Septik Şok Özeti.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByLabel("Başlık")).toHaveValue("Septik Şok Özeti");
  await page.getByLabel("Başlık").fill(title);
  // Etiketler (D25): biri yeni yazılır (Enter), biri mevcut etiketin farklı yazımı → mevcut yazıma çevrilir.
  const labelInput = page.getByLabel("Etiketler", { exact: true });
  await labelInput.fill("Çocuk  Kardiyoloji ");
  await labelInput.press("Enter");
  await labelInput.fill("neonatoloji");
  await page.getByRole("button", { name: "Etiket ekle" }).click();
  await labelInput.fill("ÇOCUK KARDİYOLOJİ");
  await labelInput.press("Enter");
  await expect(page.getByText('"ÇOCUK KARDİYOLOJİ" zaten ekli.')).toBeVisible();
  const chips = page.getByRole("list", { name: "Eklenen etiketler" });
  await expect(chips.getByRole("listitem")).toHaveText(["Çocuk Kardiyoloji×", "Neonatoloji×"]);
  await page.getByLabel("3. yıl").uncheck();
  await page.getByLabel("4. yıl").uncheck();
  await page.getByLabel("Uzman", { exact: true }).check();
  await page.getByLabel("Hekimler indirebilir").check();
  await page.getByRole("button", { name: "Yükle ve yayınla" }).click();
  await expect(page.getByRole("status").filter({ hasText: `"${title}" yayınlandı` })).toBeVisible();

  await expect(page.getByRole("tab", { name: "Materyaller" })).toHaveAttribute("aria-selected", "true");
  await expect(row(page, title)).toContainText("Yayında");
  await expect(row(page, title)).toContainText("1. yıl, 2. yıl, Uzman");
  await expect(row(page, title)).toContainText("Çocuk Kardiyoloji, Neonatoloji");
  await expect(row(page, title)).toContainText("PDF");

  // Düzenle: yalnızca meta veri.
  await row(page, title)
    .getByRole("button", { name: `${title}: düzenle` })
    .click();
  const dialog = page.getByRole("dialog", { name: "Materyali düzenle" });
  const renamed = `${title} (güncel)`;
  await dialog.getByLabel("Başlık").fill(renamed);
  await dialog.getByLabel("Zorunlu okuma").check();
  await dialog.getByRole("button", { name: "Neonatoloji etiketini kaldır" }).click();
  await dialog.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Materyal güncellendi." })).toBeVisible();
  await expect(row(page, renamed)).toContainText("Zorunlu");
  await expect(row(page, renamed)).not.toContainText("Neonatoloji");
  await expect(row(page, renamed)).toContainText("Çocuk Kardiyoloji");

  // Sil: onay, sunucuda doküman da gider.
  await row(page, renamed)
    .getByRole("button", { name: `${renamed}: sil` })
    .click();
  const confirm = page.getByRole("alertdialog", { name: "Materyali sil" });
  await expect(confirm.getByRole("button", { name: "Vazgeç" })).toBeFocused();
  await confirm.getByRole("button", { name: "Materyali sil" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Materyal silindi." })).toBeVisible();
  await expect(row(page, renamed)).toHaveCount(0);
  expect(await findDocIds("materials", "title", renamed)).toEqual([]);
  await expectNoHorizontalOverflow(page);
});
