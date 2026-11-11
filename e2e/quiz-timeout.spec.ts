import { parseNineFieldQuizCsv } from "../functions/src/shared/quizCsv";
import { loginAs } from "./fixtures/auth";
import { createDraft, openStudio, publishForce, SAMPLE_CSV } from "./fixtures/quiz";
import { expect, guardedContext, test } from "./fixtures/test";

/**
 * F5.5: süre dolumu. 1 dakikalık sınavda hekim bir soruyu yanıtlar ve beklerse, süre bitince sınav kendiliğinden
 * teslim edilir (gerçek saat; sunucu toleransı içinde, geç sayılmaz) ve karne açılır. ~70 sn sürer; ekran
 * boyutundan bağımsız olduğu için yalnızca masaüstünde koşar.
 */
const QUESTIONS = parseNineFieldQuizCsv(SAMPLE_CSV.toString("utf8")).questions;

test("süre dolunca sınav kendiliğinden teslim edilir ve karne açılır (F5.5)", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name === "telefon", "Gerçek saatle ~70 sn; ekran boyutundan bağımsız, masaüstünde koşar.");
  test.setTimeout(180_000);
  const title = `E2E süre dolumu ${Date.now()}`;

  const adminCtx = await guardedContext(await browser.newContext());
  const admin = await adminCtx.newPage();
  await openStudio(admin);
  await createDraft(admin, title, "Teslimde hemen", 1);
  await publishForce(admin, title);

  const ctx = await guardedContext(await browser.newContext());
  const doctor = await ctx.newPage();
  await loginAs(doctor, "asistan2@pediatrist.test");
  await doctor.goto("/quizzes");
  await doctor.getByRole("region", { name: title }).getByRole("button", { name: "Sınava başla" }).click();
  await expect(doctor.getByRole("timer", { name: "Kalan sınav süresi" })).toHaveText(/^0[01]:\d{2}$/);
  await doctor.getByLabel(QUESTIONS[0].correctAnswers[0]).check();

  // Hiçbir şeye dokunmadan süre dolar: ekran kendiliğinden teslim eder; karne bunu kalıcı olarak söyler
  // (geçici "Süre doldu, teslim ediliyor" uyarısı teslim hızlıysa yalnızca bir an görünür).
  const report = doctor.getByRole("region", { name: title });
  await expect(report.getByLabel("Puan 33 / 100")).toBeVisible({ timeout: 90_000 });
  await expect(report.getByRole("status").filter({ hasText: "Süre doldu" })).toContainText(
    "otomatik olarak teslim edildi"
  );
  await expect(report).toContainText("1 / 3 doğru");
  // Tolerans içinde teslim edildi: geç teslim notu yok; immediate politikada tam karne.
  await expect(report.getByText("Teslim süreden sonra ulaştı")).toHaveCount(0);
  await expect(doctor.getByText(QUESTIONS[0].feedbackText)).toBeVisible();

  await ctx.close();
  await adminCtx.close();
});
