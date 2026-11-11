// @vitest-environment jsdom
import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListLimitNotice } from "@/components/ui/ListLimitNotice";
import { useCapped, type LiveState } from "@/hooks/useFirestoreSnapshot";

const ready = (data: number[]): LiveState<number[]> => ({ status: "ready", data, error: "" });

describe("useCapped (F8.2)", () => {
  it("sınırın altında ve tam sınırda liste aynen döner, kırpılmış sayılmaz", () => {
    const under = renderHook(() => useCapped(ready([1, 2]), 3)).result.current;
    expect(under).toMatchObject({ status: "ready", data: [1, 2], truncated: false, cap: 3 });
    const exact = renderHook(() => useCapped(ready([1, 2, 3]), 3)).result.current;
    expect(exact).toMatchObject({ data: [1, 2, 3], truncated: false });
  });

  it("sınır + 1 kayıt gelince fazlası gösterilmez ve kırpıldığı bildirilir", () => {
    const over = renderHook(() => useCapped(ready([1, 2, 3, 4]), 3)).result.current;
    expect(over).toMatchObject({ status: "ready", data: [1, 2, 3], truncated: true, cap: 3 });
  });

  it("aynı veriyle yeniden çizimde dizi kimliği korunur (gereksiz efekt/yeniden çizim yok)", () => {
    const state = ready([1, 2, 3, 4]);
    const hook = renderHook(() => useCapped(state, 3));
    const first = hook.result.current.data;
    hook.rerender();
    expect(hook.result.current.data).toBe(first);
  });

  it("yükleniyor ve hata durumları aynen geçer", () => {
    const loading = renderHook(() => useCapped<number>({ status: "loading", data: null, error: "" }, 3));
    expect(loading.result.current).toMatchObject({ status: "loading", data: null, truncated: false });
    const failed = renderHook(() => useCapped<number>({ status: "error", data: null, error: "Okunamadı." }, 3));
    expect(failed.result.current).toMatchObject({ status: "error", error: "Okunamadı.", truncated: false });
  });
});

describe("ListLimitNotice", () => {
  it("yalnızca kırpılmışsa görünür; sınırı ve ne yapılacağını söyler", () => {
    const { rerender, container } = render(<ListLimitNotice truncated={false} cap={100} what="en yeni sınav" />);
    expect(container.textContent).toBe("");
    rerender(<ListLimitNotice truncated cap={100} what="en yeni sınav" hint="Eskiler Arşiv sekmesindedir." />);
    expect(screen.getByRole("status").textContent).toBe(
      "Yalnızca 100 en yeni sınav gösteriliyor; daha fazlası var. Eskiler Arşiv sekmesindedir."
    );
  });
});
