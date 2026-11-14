import { describe, expect, it } from "vitest";
import { buildRoster } from "@/components/attendance/admin/AdminAttendance";
import { isLectureOpen, type Lecture } from "@/lib/attendance/live";

const doctor = (uid: string, fullName: string, residencyYear: number | null = 2) => ({
  uid,
  fullName,
  title: "Dr.",
  residencyYear,
});

describe("buildRoster (canlı katılım listesi)", () => {
  it("beklenenler + sonradan katılanlar; bekleyenler üstte, sonra mazeretli, sonra katılanlar; ada göre", () => {
    const rows = buildRoster(
      { expectedAttendees: ["a", "b", "c"] },
      [doctor("a", "Zeynep"), doctor("b", "Ali"), doctor("c", "Çağla", null), doctor("d", "Deniz")],
      [
        { uid: "a", fullName: "Zeynep", title: "Dr.", residencyYear: 2, status: "present", verifiedAtMs: 1 },
        { uid: "d", fullName: "Deniz", title: "Dr.", residencyYear: 2, status: "present", verifiedAtMs: 2 },
        {
          uid: "c",
          fullName: "Çağla",
          title: "Dr.",
          residencyYear: 2,
          status: "excused",
          verifiedAtMs: 3,
          excuseNote: "İzin",
        },
      ]
    );
    expect(rows.map((r) => [r.uid, r.record?.status ?? "none", r.expected])).toEqual([
      ["b", "none", true],
      ["c", "excused", true],
      ["d", "present", false],
      ["a", "present", true],
    ]);
    expect(rows.find((r) => r.uid === "c")).toMatchObject({ residencyYear: null });
  });

  it("artık etkin olmayan ama kaydı olan üye kayıttaki adla gösterilir", () => {
    const rows = buildRoster(
      { expectedAttendees: [] },
      [],
      [{ uid: "x", fullName: "Eski Üye", title: "Dr.", residencyYear: 2, status: "present", verifiedAtMs: 1 }]
    );
    expect(rows[0]).toMatchObject({ name: "Dr. Eski Üye" });
  });
});

describe("isLectureOpen", () => {
  const lecture = { status: "live", endsAtMs: 2_000 } as Lecture;
  it("canlı ve süresi dolmamışsa açık; süresi dolmuş canlı ders veya kapanmış ders açık değil", () => {
    expect(isLectureOpen(lecture, 1_000)).toBe(true);
    expect(isLectureOpen(lecture, 2_000)).toBe(false);
    expect(isLectureOpen({ ...lecture, status: "closed" }, 1_000)).toBe(false);
    expect(isLectureOpen(null)).toBe(false);
  });
});

describe("katılım geçmişi (F4.4, D22)", () => {
  it("toRecord mazeretli ve katılmadı durumlarını korur", async () => {
    const { toRecord } = await import("@/lib/attendance/live");
    expect(toRecord({ uid: "u", status: "absent", verifiedAt: null }).status).toBe("absent");
    expect(toRecord({ uid: "u", status: "excused", excuseNote: "İzin" })).toMatchObject({
      status: "excused",
      excuseNote: "İzin",
    });
  });

  it("özet: mazeretliler paydaya girmez; ders yoksa oran yok", async () => {
    const { summarizeHistory } = await import("@/lib/attendance/live");
    const s = (status: "present" | "excused" | "absent") => ({ status });
    expect(summarizeHistory([s("present"), s("present"), s("absent"), s("excused")])).toEqual({
      present: 2,
      excused: 1,
      absent: 1,
      rate: 2 / 3,
    });
    expect(summarizeHistory([s("excused")]).rate).toBeNull();
    expect(summarizeHistory([]).rate).toBeNull();
  });
});

describe("isAttendanceEligible (D24: yoklamayı yalnızca 1.–4. yıl asistan verir)", () => {
  it("hekim rolünde, asistan ünvanlı ve kıdemi 1–4 olan üye; diğerleri değil", async () => {
    const { isAttendanceEligible } = await import("@shared/constants");
    for (const y of [1, 2, 3, 4]) {
      expect(isAttendanceEligible({ role: "user", title: "Asistan Dr.", residencyYear: y })).toBe(true);
    }
    expect(isAttendanceEligible({ role: "admin", title: "Asistan Dr.", residencyYear: 2 })).toBe(false);
    for (const title of ["Uzm. Dr.", "Doç. Dr.", "Prof. Dr."]) {
      expect(isAttendanceEligible({ role: "user", title, residencyYear: null })).toBe(false);
      expect(isAttendanceEligible({ role: "user", title, residencyYear: 2 })).toBe(false);
    }
    expect(isAttendanceEligible({ role: "user", title: "Asistan Dr.", residencyYear: null })).toBe(false);
    expect(isAttendanceEligible({ role: "user", title: "Asistan Dr.", residencyYear: 5 })).toBe(false);
    expect(isAttendanceEligible({ role: "user", title: "Asistan Dr.", residencyYear: undefined })).toBe(false);
  });
});

describe("projektör kodu aralığı (D28)", () => {
  it("kod 30 saniyede bir değişir; hekim ipucu aynı sabitten", async () => {
    const { ATTENDANCE_SLOT_MS } = await import("@shared/constants");
    const { CODE_HINT } = await import("@/components/attendance/DoctorCheckIn");
    expect(ATTENDANCE_SLOT_MS).toBe(30_000);
    expect(CODE_HINT).toBe("Kod 30 saniyede bir yenilenir; ekrandaki güncel kodu girin.");
  });
});
