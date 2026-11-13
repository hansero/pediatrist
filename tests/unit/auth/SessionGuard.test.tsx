// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionGuard } from "@/components/security/SessionGuard";
import { useIdleExempt } from "@/lib/auth/IdleContext";
import type { ClinicMemberSession } from "@/lib/auth/types";
import { KVKK_NOTICE_VERSION } from "@shared/consent";

const acceptConsent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/firebase/callables", () => ({ acceptConsent: (d: unknown) => acceptConsent(d) }));

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
  mfaRequired: true,
  emailVerificationRequired: false,
  consentVersion: KVKK_NOTICE_VERSION,
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
    expect(screen.getByRole("heading", { name: "Başvurunuz onay bekliyor" })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Çıkış yap" }));
    });
    expect(onSignOut).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(30 * MIN));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});

describe("SessionGuard: e-posta doğrulama zorunluluğu (D21)", () => {
  it("zorunluyken doğrulanmamış etkin üye içerik yerine doğrulama ekranını görür; zorunlu değilse içerik", () => {
    const onSignOut = vi.fn().mockResolvedValue(undefined);
    const unverified = { ...session("active"), emailVerified: false, emailVerificationRequired: true };
    const { rerender } = render(
      <SessionGuard session={unverified} onSignOut={onSignOut}>
        <p>içerik</p>
      </SessionGuard>
    );
    expect(screen.getByRole("heading", { name: "E-posta adresinizi doğrulayın" })).toBeTruthy();
    expect(screen.queryByText("içerik")).toBeNull();
    expect(screen.getByRole("button", { name: "Doğrulama e-postası gönder" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Çıkış yap" })).toBeTruthy();

    rerender(
      <SessionGuard session={{ ...unverified, emailVerificationRequired: false }} onSignOut={onSignOut}>
        <p>içerik</p>
      </SessionGuard>
    );
    expect(screen.getByText("içerik")).toBeTruthy();
  });
});

describe("SessionGuard: aydınlatma metni onayı (F9.1)", () => {
  const guard = (consentVersion: string | null, onSignOut = vi.fn().mockResolvedValue(undefined)) => (
    <SessionGuard session={{ ...session("active"), consentVersion }} onSignOut={onSignOut}>
      <p>içerik</p>
    </SessionGuard>
  );

  it("güncel sürümü onaylamış üye içeriği görür; eski sürümde veya onaysızken onay ekranı", () => {
    const { rerender } = render(guard(KVKK_NOTICE_VERSION));
    expect(screen.getByText("içerik")).toBeTruthy();

    rerender(guard("0.9"));
    expect(screen.queryByText("içerik")).toBeNull();
    expect(screen.getByRole("heading", { name: "Aydınlatma metni güncellendi" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "KVKK aydınlatma metnini" }).getAttribute("href")).toBe("/kvkk");

    rerender(guard(null));
    expect(screen.getByRole("heading", { name: "Aydınlatma metnini onaylayın" })).toBeTruthy();
  });

  it("kutu işaretlenmeden onay gönderilmez; işaretlenince güncel sürüm sunucuya gider; hata gösterilir", async () => {
    acceptConsent.mockRejectedValueOnce(new Error("ağ")).mockResolvedValueOnce({ accepted: true, version: "x" });
    render(guard("0.9"));
    fireEvent.click(screen.getByRole("button", { name: "Onayla" }));
    expect(acceptConsent).not.toHaveBeenCalled();
    expect(screen.getByText("Devam etmek için aydınlatma metnini okuduğunuzu onaylayın.")).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Onayla" })));
    expect(acceptConsent).toHaveBeenCalledWith({ consentVersion: KVKK_NOTICE_VERSION });
    expect(screen.getByRole("alert")).toBeTruthy();
    // Başarıda ekran kendi kapanmaz: profil dinleyicisi yeni sürümü görünce kapanır (iyimser başarı yok).
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Onayla" })));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("heading", { name: "Aydınlatma metni güncellendi" })).toBeTruthy();
  });

  it("onaylamak istemeyen üye çıkış yapabilir", async () => {
    const onSignOut = vi.fn().mockResolvedValue(undefined);
    render(guard(null, onSignOut));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Çıkış yap" })));
    expect(onSignOut).toHaveBeenCalled();
  });
});
