// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdleProvider, useIdle, useIdleExempt } from "@/lib/auth/IdleContext";

const MIN = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-10T09:00:00Z"));
});
afterEach(() => vi.useRealTimers());

let renders = 0;
function Probe() {
  const { warning, deadlineMs, stayActive } = useIdle();
  renders++;
  return (
    <div>
      <span data-testid="state">{warning ? `uyarı:${deadlineMs}` : "etkin"}</span>
      <button type="button" onClick={stayActive}>
        devam
      </button>
    </div>
  );
}

function Exempt() {
  useIdleExempt();
  return <p>sınav</p>;
}

function setup(children = <Probe />) {
  const onTimeout = vi.fn();
  const utils = render(<IdleProvider onTimeout={onTimeout}>{children}</IdleProvider>);
  return { onTimeout, ...utils };
}

const state = () => screen.getByTestId("state").textContent;
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe("IdleProvider", () => {
  it("14. dakikada uyarı, 15. dakikada BİR kez onTimeout; arada saniyelik yeniden çizim yok", () => {
    renders = 0;
    const { onTimeout } = setup();
    const start = Date.now();
    advance(14 * MIN - 1);
    expect(state()).toBe("etkin");
    const rendersBeforeWarning = renders;
    expect(rendersBeforeWarning).toBeLessThanOrEqual(2);

    advance(1);
    expect(state()).toBe(`uyarı:${start + 15 * MIN}`);
    advance(MIN - 1);
    expect(onTimeout).not.toHaveBeenCalled();
    advance(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    advance(30 * MIN);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("etkinlik süreyi sıfırlar", () => {
    const { onTimeout } = setup();
    advance(10 * MIN);
    fireEvent.keyDown(window, { key: "a" });
    advance(13 * MIN);
    expect(state()).toBe("etkin");
    advance(MIN);
    expect(state()).toMatch(/^uyarı/);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("uyarı açıkken fare hareketi süreyi uzatmaz: bitiş anında oturum yine kapanır", () => {
    const { onTimeout } = setup();
    advance(14 * MIN);
    expect(state()).toMatch(/^uyarı/);
    fireEvent.pointerMove(window);
    fireEvent.keyDown(window, { key: "a" });
    advance(MIN);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("uyarıda 'Devam et' süreyi baştan başlatır", () => {
    const { onTimeout } = setup();
    advance(14 * MIN);
    fireEvent.click(screen.getByRole("button", { name: "devam" }));
    expect(state()).toBe("etkin");
    advance(14 * MIN - 1);
    expect(state()).toBe("etkin");
    advance(1);
    expect(state()).toMatch(/^uyarı/);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("muafiyet (sınav/projektör) sürerken uyarı ve çıkış yok; muafiyet bitince süre baştan başlar", () => {
    function Harness() {
      const [exam, setExam] = useState(true);
      return (
        <>
          <Probe />
          {exam && <Exempt />}
          <button type="button" onClick={() => setExam(false)}>
            sınavı bitir
          </button>
        </>
      );
    }
    const { onTimeout } = setup(<Harness />);
    advance(60 * MIN);
    expect(state()).toBe("etkin");
    expect(onTimeout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "sınavı bitir" }));
    advance(14 * MIN - 1);
    expect(state()).toBe("etkin");
    advance(1);
    expect(state()).toMatch(/^uyarı/);
  });

  it("uyarı açıkken muafiyet başlarsa uyarı kapanır", () => {
    function Harness() {
      const [exam, setExam] = useState(false);
      return (
        <>
          <Probe />
          {exam && <Exempt />}
          <button type="button" onClick={() => setExam(true)}>
            sınavı başlat
          </button>
        </>
      );
    }
    setup(<Harness />);
    advance(14 * MIN);
    expect(state()).toMatch(/^uyarı/);
    fireEvent.click(screen.getByRole("button", { name: "sınavı başlat" }));
    expect(state()).toBe("etkin");
  });

  it("cihaz uykusundan dönüşte süre saatten hesaplanır (zamanlayıcı gecikse bile)", () => {
    const { onTimeout } = setup();
    act(() => {
      vi.setSystemTime(Date.now() + 20 * MIN); // zamanlayıcılar çalışmadan saat ilerledi
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("başka sekmedeki etkinlik (BroadcastChannel) bu sekmenin uyarısını kapatır", async () => {
    setup();
    advance(14 * MIN);
    expect(state()).toMatch(/^uyarı/);

    const other = new BroadcastChannel("pediatrist-idle");
    other.postMessage({ type: "activity", at: Date.now() });
    await vi.waitFor(() => expect(state()).toBe("etkin"));
    other.close();
  });
});
