import { describe, expect, it } from "vitest";
import { validateQuizQuestion } from "@shared/quizQuestion";
import { buildNineFieldCsvTemplate, parseNineFieldQuizCsv } from "@/lib/quiz-parser";
import { uniqueQuizMediaPath } from "@/lib/quiz/media";
import {
  addOption,
  changeQuestionType,
  draftFromForm,
  formFromDraft,
  formSignature,
  orphanToOption,
  setOptionText,
  toggleCorrect,
} from "@/lib/quiz/questionForm";

const template = parseNineFieldQuizCsv(buildNineFieldCsvTemplate());

describe("önizleme formu (F14): CSV taslağı ↔ form", () => {
  it("geçerli her satır formdan geçince aynı soruyu üretir (doğru cevap sırası seçenek sırasıdır)", () => {
    for (const [i, row] of template.rows.entries()) {
      const v = validateQuizQuestion(draftFromForm(formFromDraft(row.draft)));
      expect(v.issues).toEqual([]);
      const expected = template.questions[i];
      expect(v.question).toEqual({
        ...expected,
        correctAnswers: expected.optionsArray.length
          ? expected.optionsArray.filter((o) => expected.correctAnswers.includes(o))
          : expected.correctAnswers,
      });
    }
  });

  it("'|' ile yazılmış seçenekler listeye, doğru cevap seçeneğe bağlanır (büyük/küçük harf duyarsız)", () => {
    const form = formFromDraft({
      caseContent: "V",
      imageUrl: "",
      questionText: "S",
      questionType: "Single Choice",
      optionsRaw: "İlaç A | ilaç B",
      optionsArray: [],
      correctAnswers: ["İLAÇ B"],
      feedbackText: "N",
    });
    expect(form.options.map((o) => [o.text, o.correct])).toEqual([
      ["İlaç A", false],
      ["ilaç B", true],
    ]);
    expect(form.orphanAnswers).toEqual([]);
  });

  it("doğru seçeneğin metni değişince doğru cevap onu izler", () => {
    const form = formFromDraft(template.rows[0].draft);
    const correct = form.options.find((o) => o.correct)!;
    const renamed = setOptionText(form, correct.id, "Yeni doğru metin");
    expect(draftFromForm(renamed).correctAnswers).toEqual(["Yeni doğru metin"]);
    expect(validateQuizQuestion(draftFromForm(renamed)).issues).toEqual([]);
    expect(formSignature(renamed)).not.toBe(formSignature(form));
  });

  it("seçeneklerde olmayan doğru cevap korunur ve doğrulayıcı bildirir; seçenek yapılınca düzelir", () => {
    const form = formFromDraft({ ...template.rows[0].draft, correctAnswers: ["Listede yok"] });
    expect(form.orphanAnswers).toEqual(["Listede yok"]);
    expect(validateQuizQuestion(draftFromForm(form)).issues).toContainEqual(
      expect.objectContaining({ field: "correctAnswers", message: "Seçeneklerde bulunmuyor: Listede yok" })
    );
    const fixed = orphanToOption(form, "Listede yok");
    expect(fixed.options.filter((o) => o.correct).map((o) => o.text)).toEqual(["Listede yok"]);
    expect(validateQuizQuestion(draftFromForm(fixed)).issues).toEqual([]);
  });

  it("tek seçimde doğru işareti radyo gibi davranır; çoklu seçimde açılıp kapanır", () => {
    const single = formFromDraft(template.rows[0].draft);
    const other = single.options.find((o) => !o.correct)!;
    expect(
      toggleCorrect(single, other.id)
        .options.filter((o) => o.correct)
        .map((o) => o.id)
    ).toEqual([other.id]);

    const multi = formFromDraft(template.rows[1].draft);
    const first = multi.options[0];
    expect(toggleCorrect(multi, first.id).options[0].correct).toBe(!first.correct);
  });

  it("tip değişimi: tek seçime geçerken fazla doğru ilkine iner ve bildirilir; açık uçluya geçiş varsayılan uzunluk verir", () => {
    const multi = formFromDraft(template.rows[1].draft);
    const toSingle = changeQuestionType(multi, "Single Choice");
    expect(toSingle.trimmedCorrect).toBe(true);
    expect(toSingle.form.options.filter((o) => o.correct)).toHaveLength(1);
    expect(validateQuizQuestion(draftFromForm(toSingle.form)).issues).toEqual([]);

    const toText = changeQuestionType(formFromDraft(template.rows[0].draft), "Text Input");
    expect(toText.trimmedCorrect).toBe(false);
    expect(Number(toText.form.maxLength)).toBeGreaterThan(0);
    expect(toText.form.acceptedAnswers.map((a) => a.text)).toEqual(["Tek doz 2 g/kg IVIG + ASA"]);
    expect(validateQuizQuestion(draftFromForm(toText.form)).issues).toEqual([]);
    // Geri dönüldüğünde seçenekler kaybolmaz.
    const back = changeQuestionType(toText.form, "Single Choice").form;
    expect(back.options).toHaveLength(4);
  });

  it("boş seçenek eklenirse doğrulayıcı reddeder", () => {
    const form = addOption(formFromDraft(template.rows[0].draft));
    expect(validateQuizQuestion(draftFromForm(form)).issues).toContainEqual(
      expect.objectContaining({ message: "Boş seçenek olamaz." })
    );
  });
});

describe("uniqueQuizMediaPath (F14)", () => {
  it("ad boşsa aynen, alınmışsa -2, -3 ekiyle döner", () => {
    expect(uniqueQuizMediaPath("Göğüs Grafisi.png", "image/png", new Set())).toBe("quiz_media/gogus-grafisi.png");
    expect(
      uniqueQuizMediaPath(
        "Göğüs Grafisi.png",
        "image/png",
        new Set(["quiz_media/gogus-grafisi.png", "quiz_media/gogus-grafisi-2.png"])
      )
    ).toBe("quiz_media/gogus-grafisi-3.png");
  });
});
