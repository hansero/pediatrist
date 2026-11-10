// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionGuard } from "@/components/security/SessionGuard";
import { useIdleExempt } from "@/lib/auth/IdleContext";
import type { ClinicMemberSession } from "@/lib/auth/types";

const MIN = 60_000;

const session = (status: "active" | "pending"): ClinicMemberSession => ({
  uid: "u1",
  email: "asistan@pediatrist.test",
  fullName: "Deneme",
  title: "Dr.",
  residencyYear: 1,
  role: "user",
  status,
  mfaVerified: false,
  mfaEnrolled: false,
  emailVerified: true,
  hasBoundDevice: false,
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("SessionGuard", () => {
  it("uyarı diyalogu: 14. dakikada alertdialog, odak 'Devam et'te; devam edince kapanır", () => {
    const onSignOut = vi.fn().mockResolvedValue(undefined);
    render(
      <SessionGuard session={session("active")} onSignOut={onSignOut}>
        <p>içerik</p>
      </SessionGuard>
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    act(() => vi.advanceTimersByTime(14 * MIN));

    const dialog = screen.getByRole("alertdialog", { name: "Oturumunuz kapanmak üzere" });
    expect(dialog.textContent).toContain("01:00");
    expect(screen.getByRole("timer", { name: "Oturumun kapanmasına kalan süre" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Devam et" }));

    fireEvent.click(screen.getByRole("button", { name: "Devam et" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it("15. dakikada nedenli gerçek çıkış (hareketsizlik); 'kilidi aç' adımı yok", () => {
    const onSignOut = vi.fn().mockResolvedValue(undefined);
    render(
      <SessionGuard session={session("active")} onSignOut={onSignOut}>
        <p>içerik</p>
      </SessionGuard>
    );
    act(() => vi.advanceTimersByTime(15 * MIN));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onSignOut).toHaveBeenCalledWith("hareketsizlik");
  });

  it("muaf ekran (sınav) açıkken uyarı çıkmaz", () => {
    function ExamScreen() {
      useIdleExempt();
      return <p>sınav</p>;
    }
    const onSignOut = vi.fn().mockResolvedValue(undefined);
    render(
      <SessionGuard session={session("active")} onSignOut={onSignOut}>
        <ExamScreen />
      </SessionGuard>
    );
    act(() => vi.advanceTimersByTime(180 * MIN));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it("onay bekleyen üye içerik görmez; çıkış yapabilir; hareketsizlik zamanlayıcısı çalışmaz", async () => {
    const onSignOut = vi.fn().mockResolvedValue(undefined);
    render(
      <SessionGuard session={session("pending")} onSignOut={onSignOut}>
        <p>içerik</p>
      </SessionGuard>
    );
    expect(screen.queryByText("içerik")).toBeNull();
    expect(screen.getByRole("heading", { name: "Üyelik Onayı Bekleniyor" })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Çıkış yap" }));
    });
    expect(onSignOut).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(30 * MIN));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
