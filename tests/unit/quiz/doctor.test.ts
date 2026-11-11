import { describe, expect, it } from "vitest";
import { createSaveQueue, isAnswered, toMyAttempt } from "@/lib/quiz/doctor";

const deferred = () => {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("yanıt kayıt sırası (F5.3)", () => {
  it("aynı anda tek istek; gönderim sürerken gelen değişikliklerden yalnızca sonuncusu gönderilir", async () => {
    const sent: number[] = [];
    const gates: ReturnType<typeof deferred>[] = [];
    const queue = createSaveQueue<number>((v) => {
      sent.push(v);
      const g = deferred();
      gates.push(g);
      return g.promise;
    });
    const p1 = queue.push(1);
    void queue.push(2);
    const p3 = queue.push(3);
    expect(sent).toEqual([1]);
    gates[0].resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(sent).toEqual([1, 3]);
    gates[1].resolve();
    await Promise.all([p1, p3]);
    expect(queue.pending).toBe(false);
  });

  it("gönderim bitince gelen yeni değer kaybolmaz (yarış yok)", async () => {
    const sent: number[] = [];
    const queue = createSaveQueue<number>(async (v) => {
      sent.push(v);
    });
    await queue.push(1);
    await queue.push(2);
    expect(sent).toEqual([1, 2]);
  });

  it("başarısız gönderim bekletilir; flush en güncel değeri yeniden dener", async () => {
    let fail = true;
    const sent: number[] = [];
    const queue = createSaveQueue<number>(async (v) => {
      sent.push(v);
      if (fail) throw new Error("ağ");
    });
    await expect(queue.push(7)).rejects.toThrow("ağ");
    expect(queue.pending).toBe(true);
    fail = false;
    await queue.flush();
    expect(sent).toEqual([7, 7]);
    expect(queue.pending).toBe(false);
  });
});

describe("hekim sınav yardımcıları", () => {
  it("yanıtlandı: boş/boşluk metin yanıt sayılmaz", () => {
    expect(isAnswered(undefined)).toBe(false);
    expect(isAnswered(["  "])).toBe(false);
    expect(isAnswered(["A"])).toBe(true);
  });

  it("girişim eşlemesi: teslim edilmemişte puan yok", () => {
    expect(toMyAttempt("q_u", { quizId: "q", status: "in_progress", deadline: { toMillis: () => 9 } })).toMatchObject({
      status: "in_progress",
      deadlineMs: 9,
      score: null,
      autoSubmitted: false,
    });
  });
});

describe("devam edilebilir girişim", () => {
  it("süre + tolerans dolmadıysa döner; teslim edilmiş veya süresi geçmiş dönmez", async () => {
    const { resumableAttempt } = await import("@/lib/quiz/doctor");
    const base = toMyAttempt("a", { quizId: "q", status: "in_progress", deadline: { toMillis: () => 100_000 } });
    expect(resumableAttempt([base], 100_000 + 29_000)).toBe(base);
    expect(resumableAttempt([base], 100_000 + 31_000)).toBeNull();
    expect(resumableAttempt([{ ...base, status: "submitted" }], 0)).toBeNull();
    const other = { ...base, attemptId: "b", quizId: "yayindaki" };
    expect(resumableAttempt([base, other], 100_000, "yayindaki")).toBe(other);
    expect(resumableAttempt([base, other], 100_000, null)).toBe(base);
  });
});
