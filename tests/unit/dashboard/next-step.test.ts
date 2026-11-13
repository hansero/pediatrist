import { describe, expect, it } from "vitest";
import type { Lecture } from "@/lib/attendance/live";
import { adminNextStep, attendanceRate, doctorNextStep, mandatoryFor } from "@/lib/dashboard";
import type { MaterialView } from "@/lib/materials/admin";
import type { QuizSummary } from "@/lib/quiz/admin";
import type { MyAttempt } from "@/lib/quiz/doctor";

const NOW = Date.UTC(2026, 10, 11, 9, 0);
const MIN = 60_000;

const lecture = (over: Partial<Lecture> = {}): Lecture => ({
  id: "L1",
  title: "Kawasaki",
  lecturer: "Öğretim üyesi",
  durationMinutes: 60,
  status: "live",
  startedAtMs: NOW - 10 * MIN,
  endsAtMs: NOW + 50 * MIN,
  presentCount: 3,
  excusedCount: 0,
  absentCount: null,
  expectedAttendees: [],
  expectedCount: 10,
  ...over,
});

const quiz = (over: Partial<QuizSummary> = {}): QuizSummary => ({
  id: "Q1",
  title: "Solunum acilleri",
  status: "published",
  durationMinutes: 15,
  closesAtMs: null,
  revealPolicy: "after_close",
  questionCount: 3,
  attemptCount: 0,
  sourceFileName: "q.csv",
  createdAtMs: NOW - 60 * MIN,
  publishedAtMs: NOW - 30 * MIN,
  closedAtMs: null,
  revealAtMs: null,
  closeReason: null,
  ...over,
});

const attempt = (over: Partial<MyAttempt> = {}): MyAttempt => ({
  attemptId: "Q1_u",
  quizId: "Q1",
  quizTitle: "Solunum acilleri",
  status: "in_progress",
  deadlineMs: NOW + 5 * MIN,
  submittedAtMs: null,
  score: null,
  correctCount: null,
  totalQuestions: 3,
  lateSubmission: false,
  autoSubmitted: false,
  ...over,
});

const material = (id: string, over: Partial<MaterialView> = {}): MaterialView => ({
  id,
  title: `Materyal ${id}`,
  description: "",
  category: "Genel Pediatri",
  targetYears: [2],
  isMandatory: true,
  allowDownload: false,
  fileType: "pdf",
  storagePath: `materials/${id}/f.pdf`,
  contentType: "application/pdf",
  sizeBytes: 1,
  uploadedByName: "Admin",
  status: "published",
  createdAtMs: NOW - 100 * MIN,
  publishedAtMs: NOW - 100 * MIN,
  ...over,
});

const base = { lecture: null, myRecordStatus: null, quiz: null, attempts: [], pendingMaterials: [], nowMs: NOW };

describe("doctorNextStep", () => {
  it("öncelik: katılmadığı açık ders → süren sınav → yeni sınav → zorunlu materyal → yok", () => {
    const all = {
      ...base,
      lecture: lecture(),
      quiz: quiz(),
      attempts: [attempt()],
      pendingMaterials: [material("m1")],
    };
    expect(doctorNextStep(all).kind).toBe("lecture");
    expect(doctorNextStep({ ...all, myRecordStatus: "present" }).kind).toBe("quiz-resume");
    expect(doctorNextStep({ ...all, myRecordStatus: "excused" }).kind).toBe("quiz-resume");
    expect(doctorNextStep({ ...all, lecture: null, attempts: [] }).kind).toBe("quiz-start");
    expect(doctorNextStep({ ...all, lecture: null, quiz: null, attempts: [] }).kind).toBe("material");
    expect(doctorNextStep(base).kind).toBe("none");
  });

  it("süresi bitmiş ders ve kapanmış canlı ders yoklama istemez", () => {
    expect(doctorNextStep({ ...base, lecture: lecture({ endsAtMs: NOW - 1 }) }).kind).toBe("none");
    expect(doctorNextStep({ ...base, lecture: lecture({ status: "closed" }) }).kind).toBe("none");
  });

  it("teslim ettiği sınav ve kapanış zamanı geçmiş sınav yeniden önerilmez", () => {
    const submitted = attempt({ status: "submitted", submittedAtMs: NOW - MIN, score: 80 });
    expect(doctorNextStep({ ...base, quiz: quiz(), attempts: [submitted] }).kind).toBe("none");
    expect(doctorNextStep({ ...base, quiz: quiz({ closesAtMs: NOW - 1 }) }).kind).toBe("none");
  });

  it("süresi (+ tolerans) dolmuş girişim devam ettirilmez", () => {
    const expired = attempt({ deadlineMs: NOW - 10 * MIN });
    const step = doctorNextStep({ ...base, quiz: quiz(), attempts: [expired] });
    // Bu sınava girmiş (süresi dolmuş): yeniden başlatma önerilmez.
    expect(step.kind).toBe("none");
  });

  it("zorunlu materyalde en eski yayın önce, kalan sayı doğru", () => {
    const step = doctorNextStep({
      ...base,
      pendingMaterials: [
        material("yeni", { publishedAtMs: NOW - MIN }),
        material("eski", { publishedAtMs: NOW - 9 * MIN }),
      ],
    });
    expect(step).toMatchObject({ kind: "material", material: { id: "eski" }, remaining: 2 });
  });
});

describe("adminNextStep", () => {
  it("süren ders → onay bekleyen → yayındaki sınav → yok", () => {
    const all = { lecture: lecture(), pendingMembers: 2, quiz: quiz(), nowMs: NOW };
    expect(adminNextStep(all).kind).toBe("lecture");
    expect(adminNextStep({ ...all, lecture: null })).toEqual({ kind: "pending-members", count: 2 });
    expect(adminNextStep({ ...all, lecture: null, pendingMembers: 0 }).kind).toBe("quiz");
    expect(adminNextStep({ ...all, lecture: null, pendingMembers: null, quiz: null }).kind).toBe("none");
  });
});

describe("mandatoryFor / attendanceRate", () => {
  it("yalnızca yayındaki, zorunlu ve kıdeme yönelik materyaller; kıdemsiz uzman hepsini görür", () => {
    const list = [
      material("a"),
      material("b", { targetYears: [3] }),
      material("c", { isMandatory: false }),
      material("d", { status: "draft" }),
    ];
    expect(mandatoryFor(list, 2).map((m) => m.id)).toEqual(["a"]);
    expect(mandatoryFor(list, null).map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("katılım oranı mazeretlileri paydaya katmaz (D22); ders yoksa null", () => {
    expect(attendanceRate(7, 3)).toBe(0.7);
    expect(attendanceRate(0, 0)).toBeNull();
  });
});
