import { describe, expect, it } from "vitest";
import { canComplete, filterMaterials, MAX_SECONDS, mergeProgress } from "@/lib/materials/doctor";
import { watermarkText } from "@/components/materials/viewer/watermark";
import type { MaterialView } from "@/lib/materials/admin";
import { labelKey } from "@shared/materials";

describe("okuma ilerlemesi (F6.3)", () => {
  it("süre birikir; son sayfa geri gitmez; tamamlandı geri alınmaz; kural sınırına kırpılır", () => {
    const saved = { secondsSpent: 100, lastPage: 5, completed: true };
    expect(mergeProgress(saved, { addSeconds: 30, page: 2, completed: false })).toEqual({
      secondsSpent: 130,
      lastPage: 5,
      completed: true,
    });
    expect(
      mergeProgress(
        { secondsSpent: MAX_SECONDS - 1, lastPage: 0, completed: false },
        { addSeconds: 99, page: 3, completed: false }
      )
    ).toEqual({
      secondsSpent: MAX_SECONDS,
      lastPage: 3,
      completed: false,
    });
  });

  it("tamamlanabilirlik: PDF son sayfa, video %90, görsel hemen", () => {
    expect(canComplete("pdf", { maxPage: 2, pageCount: 3, watchedFraction: 0 })).toBe(false);
    expect(canComplete("pdf", { maxPage: 3, pageCount: 3, watchedFraction: 0 })).toBe(true);
    expect(canComplete("pdf", { maxPage: 0, pageCount: 0, watchedFraction: 0 })).toBe(false);
    expect(canComplete("video", { maxPage: 0, pageCount: 0, watchedFraction: 0.89 })).toBe(false);
    expect(canComplete("video", { maxPage: 0, pageCount: 0, watchedFraction: 0.9 })).toBe(true);
    expect(canComplete("image", { maxPage: 0, pageCount: 0, watchedFraction: 0 })).toBe(true);
  });

  it("süzgeç: kıdem ve etiket (Türkçe büyük-küçük harf duyarsız)", () => {
    const m = (id: string, targetYears: number[], labels: string[]) => ({ id, targetYears, labels }) as MaterialView;
    const list = [m("a", [1, 2], ["Neonatoloji", "İnfeksiyon"]), m("b", [1, 2, 3, 4], ["Çocuk Acil"]), m("c", [3], [])];
    expect(filterMaterials(list, { year: 3, label: "all" }).map((x) => x.id)).toEqual(["b", "c"]);
    expect(filterMaterials(list, { year: "all", label: labelKey("neonatoloji") }).map((x) => x.id)).toEqual(["a"]);
    expect(filterMaterials(list, { year: "all", label: labelKey("İNFEKSİYON") }).map((x) => x.id)).toEqual(["a"]);
    expect(filterMaterials(list, { year: 3, label: labelKey("Neonatoloji") })).toEqual([]);
  });

  it("filigran: ad, e-posta, zaman", () => {
    expect(watermarkText("Dr. A", "a@b.test", new Date(2026, 10, 11, 9, 5).getTime())).toMatch(
      /^Dr\. A · a@b\.test · 11\.11\.2026 09:05$/
    );
  });
});
