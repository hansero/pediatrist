import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CALLABLES,
  LIMITS,
  SaveQuizDraftRequest,
  StartLectureSessionRequest,
  SubmitQuizAttemptRequest,
  UpdateMemberAccessRequest,
  VerifyRealTimeAttendanceRequest,
  docId,
} from "@shared";
import { parseNineFieldQuizCsv } from "@/lib/quiz-parser";

const root = path.resolve(import.meta.dirname, "..", "..");
const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.message);

describe("docId", () => {
  const id = docId("Oturum");
  it("boşluğu kırpar, boş ve '/' içeren değeri reddeder", () => {
    expect(id.parse("  abc  ")).toBe("abc");
    expect(messages(id.safeParse(""))).toContain("Oturum zorunludur.");
    expect(id.safeParse("a/b").success).toBe(false);
    expect(id.safeParse("..").success).toBe(false);
    expect(id.safeParse(42).success).toBe(false);
  });
});

describe("UpdateMemberAccessRequest", () => {
  it("en az bir değişiklik ister", () => {
    expect(messages(UpdateMemberAccessRequest.safeParse({ targetUid: "u1" }))).toContain(
      "Değiştirilecek en az bir alan gönderilmelidir."
    );
  });
  it("geçersiz rol ve kıdem yılını reddeder", () => {
    expect(UpdateMemberAccessRequest.safeParse({ targetUid: "u1", role: "superadmin" }).success).toBe(false);
    expect(messages(UpdateMemberAccessRequest.safeParse({ targetUid: "u1", residencyYear: 5 }))).toContain(
      "Kıdem yılı 1–4 arasında olmalıdır."
    );
  });
  it("eski takma ad 'resetDeviceBinding' artık kabul edilmez (yok sayılır)", () => {
    const r = UpdateMemberAccessRequest.safeParse({ targetUid: "u1", resetDeviceBinding: true });
    expect(r.success).toBe(false);
  });
  it("geçerli isteği kabul eder", () => {
    expect(UpdateMemberAccessRequest.parse({ targetUid: "u1", status: "active", residencyYear: 2 })).toEqual({
      targetUid: "u1",
      status: "active",
      residencyYear: 2,
    });
  });
});

describe("StartLectureSessionRequest", () => {
  it("süre sınırını ortak LIMITS'ten alır (1–240)", () => {
    const base = { title: "Ders", lecturer: "Dr. X" };
    expect(StartLectureSessionRequest.safeParse({ ...base, durationMinutes: LIMITS.lectureMinutes.max }).success).toBe(
      true
    );
    expect(messages(StartLectureSessionRequest.safeParse({ ...base, durationMinutes: 241 }))).toContain(
      "Yoklama süresi (dk) 1–240 arasında olmalıdır."
    );
    expect(StartLectureSessionRequest.safeParse({ ...base, durationMinutes: 1.5 }).success).toBe(false);
  });
  it("metni kırpar ve kategori boşsa 'Genel' yapar", () => {
    expect(StartLectureSessionRequest.parse({ title: "  Ders  ", lecturer: "Dr. X", durationMinutes: 15 })).toEqual({
      title: "Ders",
      lecturer: "Dr. X",
      category: "Genel",
      durationMinutes: 15,
    });
  });
  it("sayı yerine metin gelen başlığı reddeder (eski kodda TypeError → 'internal' olurdu)", () => {
    expect(
      messages(StartLectureSessionRequest.safeParse({ title: 123, lecturer: "Dr. X", durationMinutes: 15 }))
    ).toContain("Ders başlığı zorunludur.");
  });
});

describe("VerifyRealTimeAttendanceRequest", () => {
  const deviceId = "d".repeat(32);
  it("kodu büyük harfe çevirir ve alfabe dışı karakteri reddeder", () => {
    expect(VerifyRealTimeAttendanceRequest.parse({ sessionId: "s1", code: " k9p4x2 ", deviceId }).code).toBe("K9P4X2");
    expect(VerifyRealTimeAttendanceRequest.safeParse({ sessionId: "s1", code: "K9P4X0", deviceId }).success).toBe(
      false
    );
    expect(VerifyRealTimeAttendanceRequest.safeParse({ sessionId: "s1", code: "K9P4X", deviceId }).success).toBe(false);
  });
  it("eski takma adları (dynamicCode, clientDeviceSecret) kabul etmez", () => {
    const r = VerifyRealTimeAttendanceRequest.safeParse({
      sessionId: "s1",
      dynamicCode: "K9P4X2",
      clientDeviceSecret: deviceId,
    });
    expect(r.success).toBe(false);
  });
  it("kendi beyanına dayalı 'webAuthnVerified' bayrağını sunucuya taşımaz", () => {
    const out = VerifyRealTimeAttendanceRequest.parse({
      sessionId: "s1",
      code: "K9P4X2",
      deviceId,
      webAuthnVerified: true,
    });
    expect(out).not.toHaveProperty("webAuthnVerified");
  });
});

describe("SaveQuizDraftRequest", () => {
  const csv = readFileSync(path.join(root, "scripts", "fixtures", "quiz-ornek.csv"), "utf8");
  const parsed = parseNineFieldQuizCsv(csv);

  it("repodaki örnek CSV, ayrıştırıldıktan sonra sunucu sözleşmesinden geçer", () => {
    expect(parsed.errors).toEqual([]);
    const r = SaveQuizDraftRequest.safeParse({ title: "Örnek", durationMinutes: 20, questions: parsed.questions });
    expect(messages(r)).toEqual([]);
  });

  it("harici görsel URL'sini reddeder, quiz_media yolunu kabul eder", () => {
    const q = parsed.questions[0];
    const withImage = (imageUrl: string) =>
      SaveQuizDraftRequest.safeParse({ title: "S", durationMinutes: 10, questions: [{ ...q, imageUrl }] });
    expect(withImage("quiz_media/steeple_sign.png").success).toBe(true);
    expect(messages(withImage("https://example.com/x.png"))).toContain(
      "Soru görseli 'quiz_media/' ile başlayan bir Storage yolu olmalıdır."
    );
  });

  it("soru sayısı ve boş doğru cevap sınırlarını uygular", () => {
    const q = parsed.questions[0];
    expect(SaveQuizDraftRequest.safeParse({ title: "S", durationMinutes: 10, questions: [] }).success).toBe(false);
    expect(
      SaveQuizDraftRequest.safeParse({
        title: "S",
        durationMinutes: 10,
        questions: Array.from({ length: LIMITS.quizQuestions.max + 1 }, () => q),
      }).success
    ).toBe(false);
    expect(
      messages(
        SaveQuizDraftRequest.safeParse({ title: "S", durationMinutes: 10, questions: [{ ...q, correctAnswers: [] }] })
      )
    ).toContain("8. alan (Doğru Seçenek) boş olamaz.");
  });
});

describe("SubmitQuizAttemptRequest", () => {
  it("tabSwitchCount varsayılanı 0'dır, yanıtlar dizi olmalıdır", () => {
    expect(SubmitQuizAttemptRequest.parse({ quizId: "q1", responses: { q_001: ["A"] } }).tabSwitchCount).toBe(0);
    expect(SubmitQuizAttemptRequest.safeParse({ quizId: "q1", responses: { q_001: "A" } }).success).toBe(false);
  });
});

describe("CALLABLES kayıt defteri", () => {
  it("functions/src/index.ts'ten dışa aktarılan her callable'ın bir sözleşmesi vardır", () => {
    const index = readFileSync(path.join(root, "functions", "src", "index.ts"), "utf8");
    // `export { a, b } from "./x";` bloklarındaki adlar (çok satırlı bloklar dahil).
    const exported = [...index.matchAll(/export \{([^}]+)\}/g)].flatMap((m) =>
      m[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    const triggers = ["onClinicMemberCreated"];
    const callables = exported.filter((n) => !triggers.includes(n));
    expect(callables).toHaveLength(Object.keys(CALLABLES).length);
    expect(callables.filter((n) => !(n in CALLABLES))).toEqual([]);
    expect(Object.keys(CALLABLES).filter((n) => !callables.includes(n))).toEqual([]);
  });
});
