import { describe, expect, it } from "vitest";
import { ATTENDANCE_WARN_RATE } from "@shared/constants";
import type { AttendanceStatus } from "@shared/types";
import type { AttendanceRecordView, Lecture, LogItem, MemberSummary } from "@/lib/attendance/live";
import {
  buildDoctorReport,
  buildLectureReport,
  csvDateTime,
  defaultReportRange,
  doctorDetailCsv,
  doctorReportCsv,
  isBelowThreshold,
  lectureReportCsv,
  rangeBounds,
  ratePercent,
  REPORT_DEFAULT_DAYS,
  slugify,
} from "@/lib/attendance/reports";
import { toCsv } from "@/lib/csv";

const record = (uid: string, fullName: string, status: AttendanceStatus, extra: Partial<AttendanceRecordView> = {}) =>
  ({
    uid,
    fullName,
    title: "Asistan Dr.",
    residencyYear: 2,
    status,
    verifiedAtMs: null,
    ...extra,
  }) as AttendanceRecordView;

const log = (
  uid: string,
  sessionId: string,
  status: AttendanceStatus,
  startedAtMs: number,
  extra: Partial<LogItem> = {}
) =>
  ({
    uid,
    sessionId,
    status,
    startedAtMs,
    fullName: `Hekim ${uid}`,
    memberTitle: "Asistan Dr.",
    residencyYear: 1,
    title: `Ders ${sessionId}`,
    lecturer: "Prof. Dr. Eğitici",
    category: "Sabah Vaka & Makale Saati",
    verifiedAtMs: null,
    ...extra,
  }) as LogItem;

const doctor = (uid: string, fullName: string): MemberSummary => ({
  uid,
  fullName,
  title: "Asistan Dr.",
  residencyYear: 3,
});

describe("rapor tarih aralığı", () => {
  it("başlangıç gününün başından bitiş gününün sonuna (ikisi dahil, yerel saat)", () => {
    const b = rangeBounds({ from: "2026-11-01", to: "2026-11-10" });
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.fromMs).toBe(new Date(2026, 10, 1).getTime());
    expect(b.toMs).toBe(new Date(2026, 10, 11).getTime() - 1);
  });

  it("aynı gün geçerli; ters aralık ve geçersiz tarih Türkçe hata", () => {
    expect(rangeBounds({ from: "2026-11-10", to: "2026-11-10" }).ok).toBe(true);
    expect(rangeBounds({ from: "2026-11-10", to: "2026-11-01" })).toEqual({
      ok: false,
      error: "Başlangıç tarihi bitiş tarihinden sonra olamaz.",
    });
    expect(rangeBounds({ from: "2026-02-30", to: "2026-03-01" }).ok).toBe(false);
    expect(rangeBounds({ from: "", to: "2026-03-01" }).ok).toBe(false);
  });

  it(`varsayılan aralık son ${REPORT_DEFAULT_DAYS} gün`, () => {
    expect(defaultReportRange(new Date(2026, 10, 11, 15, 30))).toEqual({ from: "2026-08-13", to: "2026-11-11" });
  });
});

describe("eşik", () => {
  it("eşiğin tam üzerindeki oran uyarı vermez; ders yoksa uyarı yok", () => {
    expect(ATTENDANCE_WARN_RATE).toBe(0.7);
    expect(isBelowThreshold(7 / 10)).toBe(false);
    expect(isBelowThreshold(2 / 3)).toBe(true);
    expect(isBelowThreshold(null)).toBe(false);
    expect(ratePercent(2 / 3)).toBe(67);
    expect(ratePercent(null)).toBeNull();
  });
});

describe("buildLectureReport", () => {
  it("kayıtlardan özet (mazeretliler paydada değil), beklenen listesi işaretli, ada göre sıralı", () => {
    const report = buildLectureReport({ expectedAttendees: ["a", "b", "c", "d"], expectedCount: 4 }, [
      record("d", "Deniz", "absent"),
      record("a", "Zeynep", "present", { verifiedAtMs: 1 }),
      record("b", "Çağla", "present", { verifiedAtMs: 2 }),
      record("c", "Ali", "excused", { excuseNote: "Nöbet ertesi" }),
      record("x", "Burak", "present", { verifiedAtMs: 3 }),
    ]);
    expect(report.summary).toEqual({ expected: 4, present: 3, excused: 1, absent: 1, rate: 3 / 4 });
    expect(report.rows.map((r) => r.uid)).toEqual(["c", "x", "b", "d", "a"]);
    expect(report.rows.find((r) => r.uid === "x")?.expected).toBe(false);
  });
});

describe("buildDoctorReport", () => {
  const logs = [
    log("a", "s1", "present", 3),
    log("a", "s2", "absent", 2),
    log("a", "s3", "present", 1),
    log("b", "s1", "absent", 3),
    log("b", "s2", "excused", 2),
    log("b", "s3", "present", 1),
    log("gone", "s1", "present", 3, { fullName: "Eski Üye", memberTitle: "Uzm. Dr.", residencyYear: null }),
    // Süren ders: katılmadı kayıtları henüz yazılmadı; orana girmemeli.
    log("a", "live", "absent", 4),
    log("c", "live", "present", 4),
  ];
  const rows = buildDoctorReport(logs, [doctor("a", "Ayşe"), doctor("b", "Barış"), doctor("c", "Cem")], {
    excludeSessionIds: ["live"],
  });

  it("hekim başına sayılar ve oran; süren ders hariç", () => {
    const a = rows.find((r) => r.uid === "a")!;
    expect(a).toMatchObject({ present: 2, excused: 0, absent: 1, belowThreshold: true, name: "Asistan Dr. Ayşe" });
    expect(a.rate).toBeCloseTo(2 / 3);
    expect(a.items.map((i) => i.sessionId)).toEqual(["s1", "s2", "s3"]);
    expect(rows.find((r) => r.uid === "b")).toMatchObject({ present: 1, excused: 1, absent: 1, rate: 0.5 });
  });

  it("etkin ama aralıkta dersi olmayan hekim oransız görünür; etkin olmayan üyenin geçmişi logdaki adla kalır", () => {
    expect(rows.find((r) => r.uid === "c")).toMatchObject({ rate: null, belowThreshold: false, items: [] });
    expect(rows.find((r) => r.uid === "gone")).toMatchObject({
      name: "Uzm. Dr. Eski Üye",
      active: false,
      residencyYear: null,
      rate: 1,
    });
  });

  it("eşik altındakiler önce (en düşük oran başta), sonra ada göre", () => {
    expect(rows.map((r) => r.uid)).toEqual(["b", "a", "c", "gone"]);
  });
});

describe("rapor CSV'leri", () => {
  const lecture = {
    id: "s1",
    title: "Sabah Olgu Sunumu: Ateşli Süt Çocuğu",
    lecturer: "Prof. Dr. Nevin Aydoğan",
    category: "Sabah Vaka & Makale Saati",
    startedAtMs: new Date(2026, 10, 9, 8, 30).getTime(),
    expectedAttendees: ["a", "b"],
    expectedCount: 2,
  } as Lecture;

  it("ders raporu: `;` ayrılmış, BOM'lu, Türkçe başlıklar, formül enjeksiyonu korumalı", () => {
    const report = buildLectureReport(lecture, [
      record("a", "Zeynep", "present", { verifiedAtMs: new Date(2026, 10, 9, 8, 34).getTime() }),
      record("b", "Ali", "excused", { excuseNote: "=HYPERLINK(1); izin" }),
    ]);
    const csv = lectureReportCsv(lecture, report);
    expect(csv.fileName).toBe("yoklama-2026-11-09-sabah-olgu-sunumu-atesli-sut-cocugu.csv");
    const text = toCsv(csv.headers, csv.rows);
    const lines = text.replace(/^﻿/, "").trimEnd().split("\r\n");
    expect(text.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe("Ders;Tarih;Eğitici;Kategori;Hekim;Kıdem;Durum;Katılım saati;Mazeret notu;Beklenen listede");
    expect(lines[1]).toBe(
      'Sabah Olgu Sunumu: Ateşli Süt Çocuğu;2026-11-09 08:30;Prof. Dr. Nevin Aydoğan;Sabah Vaka & Makale Saati;Asistan Dr. Ali;2. yıl;Mazeretli;;"\'=HYPERLINK(1); izin";Evet'
    );
    expect(lines[2]).toContain(";Asistan Dr. Zeynep;2. yıl;Katıldı;2026-11-09 08:34;;Evet");
  });

  it("hekim karnesi ve hekim dökümü", () => {
    const rows = buildDoctorReport([log("a", "s1", "absent", lecture.startedAtMs)], [doctor("a", "Ayşe")]);
    const range = { from: "2026-11-01", to: "2026-11-11" };
    const summary = doctorReportCsv(rows, range);
    expect(summary.fileName).toBe("hekim-karnesi-2026-11-01_2026-11-11.csv");
    expect(summary.headers.at(-1)).toBe("Eşik altında (%70)");
    expect(summary.rows).toEqual([["Asistan Dr. Ayşe", "3. yıl", "Etkin", 0, 0, 1, 0, "Evet"]]);
    const detail = doctorDetailCsv(rows[0], range);
    expect(detail.fileName).toBe("hekim-karnesi-asistan-dr-ayse-2026-11-01_2026-11-11.csv");
    expect(detail.rows[0]).toEqual([
      "Asistan Dr. Ayşe",
      "2026-11-09 08:30",
      "Ders s1",
      "Prof. Dr. Eğitici",
      "Sabah Vaka & Makale Saati",
      "Katılmadı",
      "",
      "",
    ]);
  });

  it("yardımcılar", () => {
    expect(slugify("İÇ HASTALIKLARI — Ğüşöç!")).toBe("ic-hastaliklari-gusoc");
    expect(slugify("***")).toBe("rapor");
    expect(csvDateTime(null)).toBe("");
  });
});
