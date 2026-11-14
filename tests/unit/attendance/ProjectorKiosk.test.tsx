// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lecture } from "@/lib/attendance/live";

const SERVER_NOW = 1_000_000;
const lectureDoc = vi.hoisted(() => ({ current: null as unknown }));
const getProjectorCode = vi.hoisted(() => vi.fn());
vi.mock("@/lib/attendance/live", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/attendance/live")>();
  return { ...actual, useLecture: () => ({ status: "ready", data: lectureDoc.current }) };
});
vi.mock("@/lib/firebase/callables", () => ({ getProjectorCode: (d: unknown) => getProjectorCode(d) }));

const { ProjectorKiosk } = await import("@/components/attendance/ProjectorKiosk");

beforeEach(() => {
  getProjectorCode.mockReset();
  lectureDoc.current = {
    id: "s1",
    title: "Sabah Dersi",
    lecturer: "Dr. X",
    status: "live",
    presentCount: 0,
    expectedCount: 3,
    endsAtMs: SERVER_NOW + 5 * 60_000,
  } as Partial<Lecture>;
});
afterEach(() => vi.useRealTimers());

describe("ProjectorKiosk saat farkı (F13.2)", () => {
  it("bilgisayarın saati 10 dk ileriyken de ders açık görünür ve kod gösterilir (sunucu saati esas)", async () => {
    vi.useFakeTimers({ now: SERVER_NOW + 10 * 60_000 });
    getProjectorCode.mockResolvedValue({
      code: "ABC234",
      msUntilRotation: 30_000,
      endsAtMs: SERVER_NOW + 5 * 60_000,
      serverNowMs: SERVER_NOW,
    });
    render(<ProjectorKiosk sessionId="s1" />);
    await act(async () => {});
    expect(getProjectorCode).toHaveBeenCalledWith({ sessionId: "s1" });
    expect(screen.getByTestId("projector-code").textContent).toBe("ABC234");
    expect(screen.queryByRole("heading", { name: "Yoklama kapandı" })).toBeNull();
  });

  it("sunucu ders bitti derse (failed-precondition) ekran kapanır", async () => {
    vi.useFakeTimers({ now: SERVER_NOW });
    getProjectorCode.mockRejectedValue(Object.assign(new Error("bitti"), { code: "functions/failed-precondition" }));
    render(<ProjectorKiosk sessionId="s1" />);
    await act(async () => {});
    expect(screen.getByRole("heading", { name: "Yoklama kapandı" })).toBeTruthy();
  });
});
