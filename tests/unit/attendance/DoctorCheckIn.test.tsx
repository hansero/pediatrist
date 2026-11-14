// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lecture } from "@/lib/attendance/live";
import type { ClinicMemberSession } from "@/lib/auth/types";

const liveLecture = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/attendance/live", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/attendance/live")>();
  return {
    ...actual,
    useLiveLecture: () => ({ status: "ready", data: liveLecture.current }),
    useMyRecord: () => ({ status: "ready", data: null }),
  };
});
vi.mock("@/lib/firebase/callables", () => ({ verifyRealTimeAttendance: vi.fn() }));

const { DoctorCheckIn } = await import("@/components/attendance/DoctorCheckIn");

const session = { uid: "r1", fullName: "Deneme", title: "Asistan Dr." } as ClinicMemberSession;

beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
afterEach(() => vi.useRealTimers());

describe("DoctorCheckIn (F13.2)", () => {
  it("süre dolunca kod formu kapanır (ders sunucuda henüz 'live' olsa bile)", () => {
    liveLecture.current = {
      id: "s1",
      title: "Sabah Dersi",
      lecturer: "Dr. X",
      status: "live",
      endsAtMs: 1_000_000 + 3_000,
    } as Partial<Lecture>;
    render(<DoctorCheckIn session={session} />);
    expect(screen.getByLabelText(/Projektördeki kod/)).toBeTruthy();

    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.queryByLabelText(/Projektördeki kod/)).toBeNull();
    expect(screen.getByText("Yoklama süresi doldu")).toBeTruthy();
  });
});
