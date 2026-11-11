import { describe, expect, it } from "vitest";
import {
  attemptsCsv,
  filterAttempts,
  groupByDoctor,
  questionStats,
  summarizeScores,
  toAttemptRow,
  type AttemptRow,
} from "@/lib/quiz/analytics";
import { toCsv } from "@/lib/csv";

const row = (uid: string, score: number, at: number, extra: Partial<AttemptRow> = {}): AttemptRow => ({
  attemptId: `q_${uid}_${at}`,
  quizId: "q",
  quizTitle: "Sınav",
  uid,
  doctorName: `Dr. ${uid}`,
  residencyYear: 2,
  score,
  correctCount: Math.round(score / 50),
  totalQuestions: 2,
  submittedAtMs: at,
  durationSeconds: 600,
  lateSubmission: false,
  autoSubmitted: false,
  tabSwitchCount: 0,
  results: [],
  ...extra,
});

describe("sınav analitiği (F5.4)", () => {
  it("teslim edilmemiş girişim satır olmaz; teslim edilmiş eşlenir", () => {
    expect(toAttemptRow("a", { status: "in_progress", uid: "u" })).toBeNull();
    const r = toAttemptRow("a", {
      status: "submitted",
      uid: "u",
      score: 67,
      submittedAt: { toMillis: () => 5 },
      results: [{ questionId: "q_001", orderIndex: 1, isCorrect: true, userResponse: ["x"] }],
    });
    expect(r).toMatchObject({ score: 67, submittedAtMs: 5, results: [{ questionId: "q_001", isCorrect: true }] });
  });

  it("özet: ortalama/medyan yuvarlanır, son puan en yeni teslimdir; boşta null", () => {
    expect(summarizeScores([])).toEqual({ count: 0, average: null, median: null, best: null, latest: null });
    expect(summarizeScores([row("a", 100, 1), row("a", 33, 3), row("a", 67, 2), row("a", 50, 0)])).toEqual({
      count: 4,
      average: 63,
      median: 59,
      best: 100,
      latest: 33,
    });
  });

  it("soru bazında doğru oranı soru sırasıyla", () => {
    const res = (a: boolean, b: boolean) => [
      { questionId: "q_002", orderIndex: 2, isCorrect: b },
      { questionId: "q_001", orderIndex: 1, isCorrect: a },
    ];
    const stats = questionStats([
      row("a", 0, 1, { results: res(true, false) }),
      row("b", 0, 1, { results: res(true, true) }),
    ]);
    expect(stats.map((s) => [s.questionId, s.correct, s.answered, s.rate])).toEqual([
      ["q_001", 2, 2, 1],
      ["q_002", 1, 2, 0.5],
    ]);
  });

  it("hekim gruplaması kimliğe göre: aynı ad karışmaz, ad değişse bölünmez; en düşük ortalama önce", () => {
    const rows = [
      row("u1", 100, 1, { doctorName: "Dr. Ali" }),
      row("u1", 80, 2, { doctorName: "Dr. Ali Yılmaz" }), // ad değişti
      row("u2", 40, 1, { doctorName: "Dr. Ali" }), // aynı ad, başka hekim
    ];
    const groups = groupByDoctor(rows);
    expect(groups.map((g) => [g.uid, g.name, g.count, g.average])).toEqual([
      ["u2", "Dr. Ali", 1, 40],
      ["u1", "Dr. Ali Yılmaz", 2, 90],
    ]);
  });

  it("süzme: kıdem (uzman = kıdemsiz) ve teslim türü", () => {
    const rows = [
      row("a", 1, 1),
      row("b", 1, 1, { residencyYear: null, autoSubmitted: true }),
      row("c", 1, 1, { lateSubmission: true }),
    ];
    expect(filterAttempts(rows, { year: "specialist", kind: "all" }).map((r) => r.uid)).toEqual(["b"]);
    expect(filterAttempts(rows, { year: 2, kind: "late" }).map((r) => r.uid)).toEqual(["c"]);
    expect(filterAttempts(rows, { year: "all", kind: "normal" }).map((r) => r.uid)).toEqual(["a"]);
  });

  it("sonuç CSV'si: `;` ayrılmış başlık, teslim türü ve dakika", () => {
    const csv = attemptsCsv("Pediatrik Acil: Sınav", [
      row("a", 67, new Date(2026, 10, 9, 8, 5).getTime(), { autoSubmitted: true }),
    ]);
    expect(csv.fileName).toBe("sinav-sonuclari-pediatrik-acil-sinav.csv");
    const lines = toCsv(csv.headers, csv.rows).replace(/^﻿/, "").trimEnd().split("\r\n");
    expect(lines[0]).toBe("Sınav;Hekim;Kıdem;Puan;Doğru;Soru;Teslim;Teslim türü;Süre (dk);Sekme değişimi");
    expect(lines[1]).toBe("Sınav;Dr. a;2. yıl;67;1;2;2026-11-09 08:05;Otomatik;10;0");
  });
});
