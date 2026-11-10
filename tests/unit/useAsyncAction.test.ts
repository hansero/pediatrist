// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { useAsyncAction } from "@/hooks/useAsyncAction";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useAsyncAction", () => {
  it("işlem sürerken pending, bitince sonucu verir; sonuç gelmeden başarı göstermez", async () => {
    const d = deferred<string>();
    const { result } = renderHook(() => useAsyncAction(() => d.promise));
    let returned: Promise<string | undefined>;
    act(() => {
      returned = result.current.run();
    });
    expect(result.current.pending).toBe(true);
    expect(result.current.data).toBeUndefined();
    await act(async () => d.resolve("tamam"));
    await expect(returned!).resolves.toBe("tamam");
    expect(result.current).toMatchObject({ pending: false, error: "", data: "tamam" });
  });

  it("hatayı Türkçe metne çevirir ve undefined döner", async () => {
    const { result } = renderHook(() =>
      useAsyncAction(async () => {
        throw new AppError("permission-denied", "Bu işlem için yetkiniz yok.");
      })
    );
    let out: unknown = "x";
    await act(async () => {
      out = await result.current.run();
    });
    expect(out).toBeUndefined();
    expect(result.current).toMatchObject({ pending: false, error: "Bu işlem için yetkiniz yok." });
  });

  it("çift tıklamada ikinci çağrıyı yok sayar", async () => {
    let calls = 0;
    const d = deferred<number>();
    const { result } = renderHook(() =>
      useAsyncAction(() => {
        calls++;
        return d.promise;
      })
    );
    await act(async () => {
      void result.current.run();
      void result.current.run();
    });
    expect(calls).toBe(1);
    await act(async () => d.resolve(1));
    await waitFor(() => expect(result.current.pending).toBe(false));
  });

  it("yeni çağrı eski hatayı temizler; reset durumu sıfırlar", async () => {
    let fail = true;
    const { result } = renderHook(() =>
      useAsyncAction(async () => {
        if (fail) throw new AppError("not-found", "Yok.");
        return 5;
      })
    );
    await act(async () => void (await result.current.run()));
    expect(result.current.error).toBe("Yok.");
    fail = false;
    await act(async () => void (await result.current.run()));
    expect(result.current).toMatchObject({ error: "", data: 5 });
    act(() => result.current.reset());
    expect(result.current).toMatchObject({ pending: false, error: "", data: undefined });
  });
});
