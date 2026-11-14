import { readFileSync } from "node:fs";
import path from "node:path";
import { seriousViolations } from "./fixtures/a11y";
import { auditMetadata, findDocIds, readDocumentDeep } from "./fixtures/emulator";
import { openStudio, quizRow, SAMPLE_CSV } from "./fixtures/quiz";
import { expect, expectNoHorizontalOverflow, test } from "./fixtures/test";

/**
 * F14 (D29): "Yeni sınav" önizlemesinde soru düzenleme ve görsel ekleme. Gerçek Storage yüklemesi, gerçek
 * `saveQuizDraft` ve Firestore'da sonucun doğrulanması. Her proje kendi benzersiz adlarını kullanır.
 */
const PNG = readFileSync(path.join(__dirname, "..", "scripts", "fixtures", "files", "steeple_sign.png"));

/** Örnek CSV + çıkarılacak 4. soru; 1. sorunun tipi bozuk ("Tek Seçim"). */
function previewCsv(): Buffer {
  const text = SAMPLE_CSV.toString("utf8").replace(/\r?\n$/, "");
  const lines = text.split(/\r?\n/);
  const extra = lines[1].replace("2.5 yaşında erkek hasta", "ÇIKARILACAK SORU 2.5 yaşında erkek hasta");
  return Buffer.from(
    [lines[0], lines[1].replace('"Single Choice"', '"Tek Seçim"'), ...lines.slice(2), extra].join("\n")
  );
}

test("önizlemede hatalı satır düzeltilir, görsel yüklenir/seçilir, cevap yapısı ve sıra değişir; kayıt sunucuda aynen (F14)", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const title = `E2E önizleme ${stamp}`;
  const fileName = `e2e onizleme ${stamp}.png`;
  const firstPath = `quiz_media/e2e-onizleme-${stamp}.png`;
  const secondPath = `quiz_media/e2e-onizleme-${stamp}-2.png`;
  const card = (n: number) => page.getByRole("article", { name: `Soru ${n}`, exact: true });

  await openStudio(page, "Yeni sınav");
  await page
    .getByLabel("Soru dosyası (CSV)")
    .setInputFiles({ name: "onizleme.csv", mimeType: "text/csv", buffer: previewCsv() });
  const save = page.getByRole("button", { name: "Taslak olarak kaydet" });

  // 1) Hatalı satır önizlemede: kart işaretli, kayıt kapalı; "Soruya git" ile kartta düzeltilir.
  await expect(page.getByText("onizleme.csv: 4 soru")).toBeVisible();
  const errors = page.getByRole("table", { name: "CSV hataları" });
  await expect(errors.getByRole("row").filter({ hasText: "4: Soru Tipi" })).toContainText("2");
  await expect(card(1)).toContainText("1 hata");
  await expect(card(1)).toContainText("Tip geçersiz");
  await expect(save).toBeDisabled();
  await errors.getByRole("button", { name: /Soruya git/ }).click();
  await expect(card(1).getByRole("heading", { name: "Soru 1" })).toBeFocused();
  await card(1).getByLabel("Tek seçim").check();
  await expect(errors).toHaveCount(0);
  await expect(card(1)).not.toContainText("1 hata");
  await expect(card(1)).toContainText("Düzenlendi");
  await card(1).getByRole("button", { name: "Soru 1: bitti, düzenlemeyi kapat" }).click();

  // 2) Soru 1'e bilgisayardan görsel yüklenir.
  await card(1).getByRole("button", { name: "Soru 1: görsel ekle" }).click();
  let picker = page.getByRole("dialog", { name: "Soru 1 görseli" });
  await picker.getByLabel("Görsel dosyası").setInputFiles({ name: fileName, mimeType: "image/png", buffer: PNG });
  await expect(picker.getByText(`Kaydedilecek ad: ${firstPath}`)).toBeVisible();
  await picker.getByRole("button", { name: "Yükle ve ekle" }).click();
  await expect(picker).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: `Soru 1 için eklendi (${firstPath})` })).toBeVisible();
  await expect(card(1).getByRole("img", { name: "Soru 1 görseli" })).toHaveJSProperty("complete", true);

  // 3) Soru 2: SVG reddedilir; aynı ad yeniden yüklenmez, "-2" ile yeni ad alır; sonra yüklü görsellerden seçilir.
  await card(2).getByRole("button", { name: "Soru 2: görsel ekle" }).click();
  picker = page.getByRole("dialog", { name: "Soru 2 görseli" });
  await picker
    .getByLabel("Görsel dosyası")
    .setInputFiles({ name: "x.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
  await expect(picker.getByText("Yalnızca PNG, JPEG, WebP veya GIF görsel yüklenebilir.")).toBeVisible();
  await expect(picker.getByRole("button", { name: "Yükle ve ekle" })).toBeDisabled();
  await picker.getByLabel("Görsel dosyası").setInputFiles({ name: fileName, mimeType: "image/png", buffer: PNG });
  await expect(picker.getByText(`Kaydedilecek ad: ${secondPath}`)).toBeVisible();
  await picker.getByRole("button", { name: "Yükle ve ekle" }).click();
  await expect(page.getByRole("status").filter({ hasText: `Soru 2 için eklendi (${secondPath})` })).toBeVisible();

  await card(2).getByRole("button", { name: "Soru 2: görseli değiştir" }).click();
  picker = page.getByRole("dialog", { name: "Soru 2 görseli" });
  await picker.getByRole("tab", { name: "Yüklü görsellerden seç" }).click();
  await picker.getByLabel("Ada göre süz").fill(stamp);
  await expect(picker.getByRole("radio")).toHaveCount(2);
  await expect(picker.getByRole("radio", { name: secondPath.replace("quiz_media/", "") })).toBeChecked();
  await picker.getByRole("radio", { name: firstPath.replace("quiz_media/", ""), exact: true }).check();
  await picker.getByRole("button", { name: "Seçili görseli ekle" }).click();
  await expect(page.getByRole("status").filter({ hasText: `Görsel Soru 2 için eklendi (${firstPath})` })).toBeVisible();

  // 4) Soru 2 cevap yapısı: seçenek eklenir ve doğru işaretlenir; doğru seçeneğin metni düzenlenir.
  await card(2).getByRole("button", { name: "Soru 2: düzenle" }).click();
  await expect(card(2).getByLabel("Vaka (1. alan)")).toBeFocused();
  expect(await seriousViolations(page)).toEqual([]);
  await expectNoHorizontalOverflow(page);
  await card(2).getByRole("button", { name: "Seçenek ekle" }).click();
  await card(2).getByLabel("Seçenek 5", { exact: true }).fill("E2E ek doğru seçenek");
  await card(2).getByLabel("Doğru: seçenek 5").check();
  await card(2).getByLabel("Seçenek 1", { exact: true }).fill("20 mL/kg izotonik bolus (düzenlendi)");
  // Enter tek satırlık alanda taslağı kaydetmez.
  await card(2).getByLabel("Seçenek 1", { exact: true }).press("Enter");
  await card(2).getByLabel("Öğrenme notu (9. alan)").fill("E2E öğrenme notu");
  await card(2).getByRole("button", { name: "Soru 2: bitti, düzenlemeyi kapat" }).click();
  await expect(card(2).getByRole("button", { name: "Soru 2: düzenle" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Yeni sınav" })).toHaveAttribute("aria-selected", "true");

  // 5) Sıra: Soru 3 en üste; 4. soru (onaylı) çıkarılır.
  await card(3).getByRole("button", { name: "Soru 3: yukarı taşı" }).click();
  await expect(page.getByText("Soru 3, 2. sıraya taşındı.")).toBeAttached();
  await card(2).getByRole("button", { name: "Soru 2: yukarı taşı" }).click();
  await expect(card(1)).toContainText("Açık uçlu");
  await card(4).getByRole("button", { name: "Soru 4: sınavdan çıkar" }).click();
  await page
    .getByRole("alertdialog", { name: "Soruyu sınavdan çıkar" })
    .getByRole("button", { name: "Sınavdan çıkar" })
    .click();
  await expect(page.getByText("onizleme.csv: 3 soru (önizlemede düzenlendi)")).toBeVisible();
  await expect(page.getByText("ÇIKARILACAK SORU")).toHaveCount(0);

  // 6) Sekme değişince düzenlemeler korunur.
  await page.getByRole("tab", { name: "Görseller" }).click();
  await page.getByRole("tab", { name: "Yeni sınav" }).click();
  await expect(page.getByText("onizleme.csv: 3 soru (önizlemede düzenlendi)")).toBeVisible();
  await expect(card(3).getByRole("img", { name: "Soru 3 görseli" })).toBeVisible();

  // 7) Kayıt: sunucu onayından sonra; Firestore'daki soru seti önizlemeyle aynı.
  await page.getByLabel("Sınav başlığı").fill(title);
  await expect(save).toBeEnabled();
  await save.click();
  await expect(
    page.getByRole("status").filter({ hasText: `"${title}" taslak olarak kaydedildi (3 soru).` })
  ).toBeVisible();
  await expect(quizRow(page, title)).toContainText("Taslak");

  const [quizId] = await findDocIds("quizzes", "title", title);
  const q = (id: string) => readDocumentDeep(`quizzes/${quizId}/questions_public/${id}`);
  const key = (id: string) => readDocumentDeep(`quiz_answer_keys/${quizId}/items/${id}`);
  expect(await q("q_001")).toMatchObject({ questionType: "Text Input", imageUrl: "quiz_media/steeple_sign.png" });
  expect(await q("q_002")).toMatchObject({ questionType: "Single Choice", imageUrl: firstPath });
  expect(await key("q_002")).toMatchObject({ correctAnswers: ["Tek doz 2 g/kg IVIG + Aspirin (ASA)"] });
  const third = await q("q_003");
  expect(third).toMatchObject({ questionType: "Multiple Choice", imageUrl: firstPath });
  expect(third?.optionsArray).toEqual([
    "20 mL/kg izotonik bolus (düzenlendi)",
    "Damar yolu 90 sn'de açılamazsa intraosseöz (IO) erişim",
    "İlk basamakta %5 dekstroz hipotonik sıvı yüklemesi",
    "Bolus sonrası perfüzyon ve karaciğer boyutunun yeniden değerlendirilmesi",
    "E2E ek doğru seçenek",
  ]);
  expect(await key("q_003")).toEqual({
    correctAnswers: [
      "20 mL/kg izotonik bolus (düzenlendi)",
      "Damar yolu 90 sn'de açılamazsa intraosseöz (IO) erişim",
      "Bolus sonrası perfüzyon ve karaciğer boyutunun yeniden değerlendirilmesi",
      "E2E ek doğru seçenek",
    ],
    feedbackText: "E2E öğrenme notu",
  });
  expect(await q("q_004")).toBeNull();
  expect(await auditMetadata("QUIZ_DRAFT_CREATED_FROM_CSV", quizId)).toMatchObject({
    questionCount: 3,
    editedInPreview: true,
  });

  // Önizleme kayıttan sonra temizlenir.
  await page.getByRole("tab", { name: "Yeni sınav" }).click();
  await expect(page.getByRole("region", { name: "Soru önizlemesi" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
