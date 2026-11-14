import { describe, expect, it } from "vitest";
import { canComplete, createProgressSaver, filterMaterials, MAX_SECONDS, mergeProgress } from "@/lib/materials/doctor";
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
    const spec = { id: "s", targetYears: [], targetSpecialists: true, labels: [] } as unknown as MaterialView;
    expect(filterMaterials([...list, spec], { year: "specialist", label: "all" }).map((x) => x.id)).toEqual(["s"]);
  });

  it("filigran: ad, e-posta, zaman", () => {
    expect(watermarkText("Dr. A", "a@b.test", new Date(2026, 10, 11, 9, 5).getTime())).toMatch(
      /^Dr\. A · a@b\.test · 11\.11\.2026 09:05$/
    );
  });
});

describe("createProgressSaver (F13.4: sıralı ilerleme kaydı)", () => {
  type Value = { secondsSpent: number; lastPage: number; completed: boolean };
  function deferred() {
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  it("düzenli kayıt sürerken 'Tamamlandı': saniyeler kaybolmaz, son yazım tamamlandı ve toplam süreyle", async () => {
    const writes: Value[] = [];
    const pending: ReturnType<typeof deferred>[] = [];
    const state = { page: 3, completed: false };
    const saver = createProgressSaver({
      saved: { secondsSpent: 100, lastPage: 2, completed: false },
      current: () => state,
      write: (v) => {
        writes.push(v);
        const d = deferred();
        pending.push(d);
        return d.promise;
      },
    });

    saver.addSeconds(15);
    const periodic = saver.flush(); // uçuşta
    saver.addSeconds(5);
    state.completed = true;
    const complete = saver.flush(); // "Tamamlandı"
    expect(writes).toHaveLength(1); // ikinci yazım birincinin bitmesini bekler

    pending[0].resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(writes).toHaveLength(2);
    pending[1].resolve();
    await Promise.all([periodic, complete]);

    expect(writes[0]).toEqual({ secondsSpent: 115, lastPage: 3, completed: false });
    // Önceden ikinci yazım aynı eski değerden (100) hesaplanıp 105 yazıyordu.
    expect(writes[1]).toEqual({ secondsSpent: 120, lastPage: 3, completed: true });
    expect(saver.saved).toEqual(writes[1]);
  });

  it("gönderilemeyen saniyeler sonraki kayıtta yeniden gönderilir", async () => {
    const writes: Value[] = [];
    let fail = true;
    const saver = createProgressSaver({
      saved: { secondsSpent: 0, lastPage: 0, completed: false },
      current: () => ({ page: 1, completed: false }),
      write: async (v) => {
        writes.push(v);
        if (fail) throw new Error("ağ");
      },
    });
    saver.addSeconds(10);
    await expect(saver.flush()).rejects.toThrow("ağ");
    fail = false;
    saver.addSeconds(5);
    await saver.flush();
    expect(writes.at(-1)).toEqual({ secondsSpent: 15, lastPage: 1, completed: false });
    expect(saver.saved.secondsSpent).toBe(15);
  });
});
