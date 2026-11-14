// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildNineFieldCsvTemplate } from "@/lib/quiz-parser";
import { changeQuestionType } from "@/lib/quiz/questionForm";

const listQuizMedia = vi.fn<() => Promise<string[]>>();
vi.mock("@/lib/quiz/media", () => ({ listQuizMedia: () => listQuizMedia() }));

const { useCsvQuestions } = await import("@/components/quizzes/admin/useCsvQuestions");

/** jsdom'un `File`'ında `text()` yok; hook yalnızca `name`, `size` ve `text()` kullanır. */
const csvFile = (text: string, name = "sinav.csv") =>
  ({ name, size: new TextEncoder().encode(text).byteLength, text: async () => text }) as unknown as File;
const TEMPLATE = buildNineFieldCsvTemplate();
const BROKEN_TYPE = TEMPLATE.replace("Single Choice", "Tek Seçim");

async function loaded(text: string) {
  const hook = renderHook(() => useCsvQuestions());
  await act(() => hook.result.current.load(csvFile(text)));
  await waitFor(() => expect(hook.result.current.mediaCheck).not.toBe("checking"));
  return hook;
}

beforeEach(() => {
  listQuizMedia.mockReset();
  listQuizMedia.mockResolvedValue(["quiz_media/steeple_sign.png", "quiz_media/baska.png"]);
});

describe("useCsvQuestions (F14): düzenlenebilir önizleme", () => {
  it("geçerli CSV: hazır, düzenlenmemiş; görseller bir kez denetlenir", async () => {
    const { result } = await loaded(TEMPLATE);
    expect(result.current.items).toHaveLength(3);
    expect(result.current.ready).toBe(true);
    expect(result.current.dirty).toBe(false);
    expect(result.current.questions).toHaveLength(3);
    expect(listQuizMedia).toHaveBeenCalledTimes(1);
  });

  it("hatalı satır önizlemede görünür; düzeltilince hazır olur ve düzenlenmiş sayılır", async () => {
    const { result } = await loaded(BROKEN_TYPE);
    expect(result.current.items).toHaveLength(3);
    expect(result.current.ready).toBe(false);
    expect(result.current.issueRows).toEqual([
      expect.objectContaining({ row: 2, field: "4: Soru Tipi", number: 1, key: result.current.items[0].key }),
    ]);
    const first = result.current.items[0];
    act(() => result.current.update(first.key, changeQuestionType(first.form, "Single Choice").form));
    expect(result.current.issueRows).toEqual([]);
    expect(result.current.ready).toBe(true);
    expect(result.current.dirty).toBe(true);
  });

  it("taşıma ve silme: sıra değişir, numaralar güncellenir, CSV satırı korunur; boş sınav kaydedilemez", async () => {
    const { result } = await loaded(TEMPLATE);
    const [a, b, c] = result.current.items.map((i) => i.key);
    act(() => result.current.move(c, -1));
    expect(result.current.items.map((i) => [i.key, i.number, i.sourceRow])).toEqual([
      [a, 1, 2],
      [c, 2, 4],
      [b, 3, 3],
    ]);
    expect(result.current.dirty).toBe(true);
    act(() => result.current.move(a, -1)); // ilk soru yukarı taşınamaz
    expect(result.current.items[0].key).toBe(a);

    act(() => {
      result.current.remove(a);
      result.current.remove(b);
      result.current.remove(c);
    });
    expect(result.current.ready).toBe(false);
    expect(result.current.countProblem).toBe("Sınavda en az 1 soru olmalı.");
  });

  it("Storage'da olmayan görsel kaydı engeller; görsel seçilince ya da kaldırılınca engel kalkar", async () => {
    const { result } = await loaded(TEMPLATE.replace("quiz_media/steeple_sign.png", "quiz_media/yok.png"));
    expect(result.current.missingMedia).toEqual([expect.objectContaining({ row: 4, path: "quiz_media/yok.png" })]);
    expect(result.current.ready).toBe(false);
    const third = result.current.items[2].key;
    act(() => result.current.setImage(third, "quiz_media/yeni-yuklenen.png"));
    expect(result.current.missingMedia).toEqual([]);
    expect(result.current.ready).toBe(true);
    expect(result.current.questions[2].imageUrl).toBe("quiz_media/yeni-yuklenen.png");
    act(() => result.current.setImage(third, ""));
    expect(result.current.questions[2].imageUrl).toBe("");
  });

  it("bozuk JSON hücresi: satır düzenlenene ya da onaylanana kadar CSV hatası gösterilir", async () => {
    const broken = TEMPLATE.replace(/"\[""20 mL\/kg/, '"[bozuk ""20 mL/kg');
    const { result } = await loaded(broken);
    const second = result.current.items[1];
    expect(second.issues).toEqual([expect.objectContaining({ label: "7: Seçenekler (JSON)" })]);
    act(() => result.current.confirm(second.key));
    expect(result.current.items[1].issues.map((i) => i.label)).not.toContain("7: Seçenekler (JSON)");
  });

  it("görsel listesi alınamazsa kaydedilemez; yeniden denenebilir", async () => {
    listQuizMedia.mockRejectedValueOnce(new Error("ağ yok"));
    const { result } = await loaded(TEMPLATE);
    expect(result.current.mediaCheck).toBe("error");
    expect(result.current.ready).toBe(false);
    act(() => result.current.retryMediaCheck());
    await waitFor(() => expect(result.current.mediaCheck).toBe("done"));
    expect(result.current.ready).toBe(true);
  });
});
