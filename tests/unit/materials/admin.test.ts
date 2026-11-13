import { describe, expect, it, vi } from "vitest";
import {
  buildReadReport,
  formatBytes,
  materialFileProblem,
  readReportCsv,
  runMaterialUpload,
  type ProgressView,
} from "@/lib/materials/admin";
import { toCsv } from "@/lib/csv";

const doctor = (uid: string, residencyYear: number | null, fullName = uid) => ({
  uid,
  fullName,
  title: "Asistan Dr.",
  residencyYear,
});
const progress = (uid: string, completed: boolean, secondsSpent = 120): ProgressView => ({
  uid,
  completed,
  secondsSpent,
  lastPage: 3,
  updatedAtMs: 1,
});

describe("materyal yükleme akışı (F6.2)", () => {
  const steps = () => ({
    create: vi.fn(async () => ({ materialId: "m1", storagePath: "materials/m1/a.pdf" })),
    upload: vi.fn(async () => {}),
    finalize: vi.fn(async () => ({})),
    discard: vi.fn(async () => ({})),
  });

  it("taslak → yükleme → yayın; temizlik yok", async () => {
    const s = steps();
    await expect(runMaterialUpload(s)).resolves.toEqual({ materialId: "m1" });
    expect(s.upload).toHaveBeenCalledWith("materials/m1/a.pdf");
    expect(s.finalize).toHaveBeenCalledWith("m1");
    expect(s.discard).not.toHaveBeenCalled();
  });

  it("yükleme iptal/hata veya sunucu doğrulaması reddederse taslak silinir ve asıl hata iletilir", async () => {
    for (const failing of ["upload", "finalize"] as const) {
      const s = steps();
      s[failing].mockRejectedValueOnce(Object.assign(new Error("x"), { code: "storage/canceled" }));
      await expect(runMaterialUpload(s)).rejects.toMatchObject({ code: "storage/canceled" });
      expect(s.discard).toHaveBeenCalledWith("m1");
    }
  });

  it("temizlik de başarısızsa kullanıcıya elle silmesi söylenir; taslak oluşmadıysa temizlik denenmez", async () => {
    const s = steps();
    s.upload.mockRejectedValueOnce(new Error("ağ"));
    s.discard.mockRejectedValueOnce(new Error("ağ"));
    await expect(runMaterialUpload(s)).rejects.toThrow("Listeden taslağı elle silin.");
    const t = steps();
    t.create.mockRejectedValueOnce(new Error("yetki"));
    await expect(runMaterialUpload(t)).rejects.toThrow("yetki");
    expect(t.discard).not.toHaveBeenCalled();
  });

  it("dosya denetimi: tür (pptx yok), boş ve boyut", () => {
    expect(materialFileProblem({ type: "application/pdf", size: 10 })).toBeNull();
    expect(
      materialFileProblem({
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        size: 10,
      })
    ).toContain("Sunumları PDF olarak");
    expect(materialFileProblem({ type: "video/mp4", size: 0 })).toBe("Dosya boş.");
    expect(materialFileProblem({ type: "video/mp4", size: 151 * 1024 * 1024 })).toContain("150 MB");
    expect(formatBytes(1536)).toBe("2 KB");
    expect(formatBytes(5.25 * 1024 * 1024)).toBe("5,3 MB");
  });
});

describe("okunma raporu (F6.2)", () => {
  const doctors = [doctor("a", 1, "Ayşe"), doctor("b", 2, "Burak"), doctor("c", 2, "Can"), doctor("u", null, "Uzman")];

  it("hedef kitle = hedef kıdemdeki etkin asistanlar; hedef dışı okuyan listede ama orana katılmaz", () => {
    const report = buildReadReport({ targetYears: [2] }, doctors, [
      progress("b", true),
      progress("a", false),
      progress("eski", true),
    ]);
    expect(report).toMatchObject({ targeted: 2, completed: 1, started: 0, notStarted: 1 });
    expect(report.rows.map((r) => [r.uid, r.status, r.targeted])).toEqual([
      ["c", "not_started", true],
      ["a", "started", false],
      ["b", "completed", true],
      ["eski", "completed", false],
    ]);
    expect(report.rows.find((r) => r.uid === "eski")?.name).toBe("Etkin olmayan üye");
  });

  it("CSV: Türkçe başlık, dakika, hedef kitle", () => {
    const report = buildReadReport({ targetYears: [2] }, doctors, [progress("b", true, 600)]);
    const csv = readReportCsv("Septik Şok", report.rows);
    expect(csv.fileName).toBe("okunma-raporu-septik-sok.csv");
    const lines = toCsv(csv.headers, csv.rows).replace(/^﻿/, "").trimEnd().split("\r\n");
    expect(lines[0]).toBe("Materyal;Hekim;Kıdem;Hedef kitlede;Durum;Süre (dk);Son sayfa");
    expect(lines).toContain("Septik Şok;Asistan Dr. Burak;2. yıl;Evet;Tamamladı;10;3");
  });
});
