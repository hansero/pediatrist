// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Countdown, formatRemaining } from "@/components/ui/Countdown";

const T0 = new Date("2026-11-10T10:00:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("formatRemaining", () => {
  it("dd:ss / ss:dd:ss, yukarı yuvarlar, negatifte sıfır", () => {
    expect(formatRemaining(61_000)).toBe("01:01");
    expect(formatRemaining(400)).toBe("00:01");
    expect(formatRemaining(3_600_000)).toBe("01:00:00");
    expect(formatRemaining(-5_000)).toBe("00:00");
  });
});

describe("Countdown", () => {
  it("role=timer, erişilebilir ad; sunucu bitiş anından hesaplar ve saat farkını düzeltir", () => {
    render(<Countdown deadlineMs={T0 + 10 * 60_000} clockOffsetMs={60_000} label="Kalan sınav süresi" />);
    const timer = screen.getByRole("timer", { name: "Kalan sınav süresi" });
    expect(timer.textContent).toBe("09:00");
  });

  it("eşiklerde kibar duyuru, uyarı görünümü; bitişte onExpire YALNIZCA bir kez", () => {
    const onExpire = vi.fn();
    const { container } = render(
      <Countdown deadlineMs={T0 + 302_000} label="Kalan süre" warnAtSeconds={[300, 60]} onExpire={onExpire} />
    );
    const live = container.querySelector('[aria-live="polite"]')!;
    const root = container.querySelector(".ui-countdown")!;
    expect(root.getAttribute("data-state")).toBe("normal");
    expect(live.textContent).toBe("");

    act(() => vi.advanceTimersByTime(2_000));
    expect(live.textContent).toBe("Kalan süre: 5 dakika kaldı.");
    expect(root.getAttribute("data-state")).toBe("warning");

    act(() => vi.advanceTimersByTime(240_000));
    expect(live.textContent).toBe("Kalan süre: 1 dakika kaldı.");

    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole("timer").textContent).toBe("00:00");
    expect(root.getAttribute("data-state")).toBe("expired");
    expect(live.textContent).toBe("Kalan süre: süre doldu.");
    act(() => vi.advanceTimersByTime(5_000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("açılışta zaten geçilmiş eşikler duyurulmaz; arka planda atlanan eşiklerden yalnızca en yakını duyurulur", () => {
    const { container, rerender } = render(<Countdown deadlineMs={T0 + 120_000} label="Süre" />);
    const live = () => container.querySelector('[aria-live="polite"]')!.textContent;
    act(() => vi.advanceTimersByTime(1_000));
    expect(live()).toBe("");

    // Yeni bitiş anı: 6 dk; sekme uyutulmuş gibi 5,5 dk tek seferde geçer.
    rerender(<Countdown deadlineMs={Date.now() + 360_000} label="Süre" />);
    act(() => {
      vi.setSystemTime(Date.now() + 330_000);
      vi.advanceTimersByTime(1_000);
    });
    expect(live()).toBe("Süre: 1 dakika kaldı.");
  });

  it("süresi geçmiş bitiş anında hemen onExpire; zamanlayıcı kurulmaz", () => {
    const onExpire = vi.fn();
    render(<Countdown deadlineMs={T0 - 1} label="Süre" onExpire={onExpire} />);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
