import { describe, expect, it } from "vitest";
import { buildRoster } from "@/components/attendance/admin/AdminAttendance";
import { checkInUrl, parseCheckInLink } from "@/lib/attendance/checkInLink";
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

describe("checkInUrl (projektör QR'ı)", () => {
  it("dersi ve kodu sorgu parametresi olarak taşır, köken korunur", () => {
    const url = new URL(checkInUrl("https://pediatrist.web.app", "ders/1", "K9P4X2"));
    expect(url.origin).toBe("https://pediatrist.web.app");
    expect(url.pathname).toBe("/attendance");
    expect(url.searchParams.get("s")).toBe("ders/1");
    expect(url.searchParams.get("c")).toBe("K9P4X2");
  });
});

describe("parseCheckInLink (uygulama içi QR okutma, F11.2)", () => {
  const origin = "https://pediatrist.web.app";
  it("projektörün ürettiği bağlantıyla gidiş-dönüş; kod büyük harfe çevrilir", () => {
    expect(parseCheckInLink(checkInUrl(origin, "ders-1", "K9P4X2"), origin)).toEqual({
      ok: true,
      sessionId: "ders-1",
      code: "K9P4X2",
    });
    expect(parseCheckInLink(`${origin}/attendance/?s=d&c=k9p4x2`, origin)).toEqual({
      ok: true,
      sessionId: "d",
      code: "K9P4X2",
    });
  });
  it("başka site, başka sayfa ve bağlantı olmayan metin yoklama koduna dönüşmez", () => {
    expect(parseCheckInLink("https://kotu.example/attendance?s=d&c=K9P4X2", origin)).toEqual({
      ok: false,
      reason: "foreign",
    });
    expect(parseCheckInLink(`${origin}/materials?s=d&c=K9P4X2`, origin)).toEqual({ ok: false, reason: "foreign" });
    expect(parseCheckInLink("http://pediatrist.web.app/attendance?s=d&c=K9P4X2", origin)).toMatchObject({
      reason: "foreign",
    });
    expect(parseCheckInLink("K9P4X2", origin)).toEqual({ ok: false, reason: "not-url" });
    expect(parseCheckInLink("", origin)).toEqual({ ok: false, reason: "not-url" });
  });
  it("ders veya kod eksik ya da kod alfabe/uzunluk dışında → bad-code", () => {
    for (const q of ["?c=K9P4X2", "?s=d", "?s=d&c=K9P4X0", "?s=d&c=K9P4X", "?s=d&c=K9P4X22", "?s=%20&c=K9P4X2"]) {
      expect(parseCheckInLink(`${origin}/attendance${q}`, origin)).toEqual({ ok: false, reason: "bad-code" });
    }
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
