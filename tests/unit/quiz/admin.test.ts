import { describe, expect, it } from "vitest";
import { QUIZ_IMAGE_PATH_RE } from "@shared/quizQuestion";
import { fromLocalInput, toLocalInput, validateSettings } from "@/components/quizzes/admin/QuizSettingsFields";
import { toArchivedQuestion, toQuizSummary } from "@/lib/quiz/admin";
import { quizMediaPath, quizMediaProblem } from "@/lib/quiz/media";

const ts = (ms: number) => ({ toMillis: () => ms });

describe("sınav ayarları (F5.2)", () => {
  it("datetime-local yerel saattir; gidiş-dönüş korunur, boş = kapanış yok", () => {
    const ms = new Date(2026, 10, 20, 14, 30).getTime();
    expect(toLocalInput(ms)).toBe("2026-11-20T14:30");
    expect(fromLocalInput("2026-11-20T14:30")).toBe(ms);
    expect(fromLocalInput("")).toBeNull();
    expect(fromLocalInput("bozuk")).toBeNaN();
  });

  it("süre aralığı ve gelecekte kapanış denetlenir", () => {
    const now = new Date(2026, 10, 11, 12, 0).getTime();
    const base = { durationMinutes: "20", closesAtLocal: "", revealPolicy: "after_close" as const };
    expect(validateSettings(base, now)).toEqual({});
    expect(validateSettings({ ...base, durationMinutes: "0" }, now).durationMinutes).toContain("1–180");
    expect(validateSettings({ ...base, durationMinutes: "12.5" }, now).durationMinutes).toBeDefined();
    expect(validateSettings({ ...base, closesAtLocal: "2026-11-11T11:59" }, now).closesAt).toBe(
      "Kapanış zamanı gelecekte bir an olmalı."
    );
    expect(validateSettings({ ...base, closesAtLocal: "2026-11-11T12:01" }, now)).toEqual({});
  });
});

describe("sınav görselleri (F5.2)", () => {
  it("dosya adından CSV yol kuralına uyan güvenli yol üretilir", () => {
    expect(quizMediaPath("Steeple Sign (AP) Çocuk.PNG", "image/png")).toBe("quiz_media/steeple-sign-ap-cocuk.png");
    expect(quizMediaPath("röntgen.jpeg", "image/jpeg")).toBe("quiz_media/rontgen.jpg");
    expect(quizMediaPath("***.webp", "image/webp")).toBe("quiz_media/gorsel.webp");
    for (const p of ["quiz_media/steeple-sign-ap-cocuk.png", quizMediaPath("ışık_ğ.gif", "image/gif")]) {
      expect(QUIZ_IMAGE_PATH_RE.test(p)).toBe(true);
    }
  });

  it("tür ve boyut sunucu kuralıyla aynı sınırlarla denetlenir", () => {
    expect(quizMediaProblem({ type: "image/png", size: 1000 })).toBeNull();
    expect(quizMediaProblem({ type: "image/svg+xml", size: 1000 })).toContain("PNG, JPEG, WebP veya GIF");
    expect(quizMediaProblem({ type: "image/png", size: 16 * 1024 * 1024 })).toContain("15 MB");
    expect(quizMediaProblem({ type: "image/png", size: 0 })).toBe("Dosya boş.");
  });
});

describe("Firestore → görünüm eşlemeleri", () => {
  it("sınav özeti: eksik alanlarda güvenli varsayılanlar (politika after_close)", () => {
    const q = toQuizSummary("q1", {
      title: "Sınav",
      status: "published",
      durationMinutes: 20,
      questionCount: 3,
      closesAt: null,
      createdAt: ts(5),
      revealAt: ts(9),
    });
    expect(q).toMatchObject({
      id: "q1",
      status: "published",
      revealPolicy: "after_close",
      closesAtMs: null,
      createdAtMs: 5,
      revealAtMs: 9,
      attemptCount: 0,
      closeReason: null,
    });
    expect(toQuizSummary("q2", { status: "bilinmeyen" }).status).toBe("draft");
  });

  it("arşiv sorusu 9 alanı taşır", () => {
    const a = toArchivedQuestion("a1", {
      sourceQuizTitle: "Eski",
      questionType: "Text Input",
      maxLength: 40,
      correctAnswers: ["Krup"],
      optionsArray: [],
      archivedAt: ts(7),
    });
    expect(a).toMatchObject({
      sourceQuizTitle: "Eski",
      questionType: "Text Input",
      maxLength: 40,
      correctAnswers: ["Krup"],
      archivedAtMs: 7,
    });
  });
});
