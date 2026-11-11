// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Yalnızca testte: Firebase Auth SDK'sı ve Next yönlendiricisi.
const h = vi.hoisted(() => ({
  replace: vi.fn(),
  signIn: vi.fn(),
  resolveSignIn: vi.fn(),
  getMultiFactorResolver: vi.fn(),
}));
vi.mock("@/lib/navigation", () => ({ hardNavigate: h.replace }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/firebase/client", () => ({ initPediatristFirebase: () => ({ auth: { name: "auth" } }) }));
vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: h.signIn,
  getMultiFactorResolver: h.getMultiFactorResolver,
  multiFactor: vi.fn(),
  TotpMultiFactorGenerator: {
    FACTOR_ID: "totp",
    assertionForSignIn: (uid: string, code: string) => ({ uid, code }),
  },
}));

const { default: LoginPage } = await import("@/app/(auth)/login/page");

const authErr = (code: string) => Object.assign(new Error(code), { code });

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/login");
  h.getMultiFactorResolver.mockReturnValue({
    hints: [{ factorId: "totp", uid: "factor-1" }],
    resolveSignIn: h.resolveSignIn,
  });
});

async function submitCredentials(email = "dr@pediatrist.test", password = "Gizli-Sifre-1") {
  fireEvent.change(screen.getByLabelText(/E-posta/), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/Şifre/), { target: { value: password } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Giriş yap" }));
  });
}

describe("Giriş sayfası", () => {
  it("MFA'sız hesap: giriş → panele yönlendirme; tarayıcı otomatik doldurma öznitelikleri", async () => {
    h.signIn.mockResolvedValue({});
    render(<LoginPage />);
    expect(screen.getByLabelText(/E-posta/).getAttribute("autocomplete")).toBe("username");
    expect(screen.getByLabelText(/Şifre/).getAttribute("autocomplete")).toBe("current-password");
    expect(screen.getByRole("link", { name: "Şifremi unuttum" }).getAttribute("href")).toBe("/reset");

    await submitCredentials(" dr@pediatrist.test ");
    expect(h.signIn).toHaveBeenCalledWith({ name: "auth" }, "dr@pediatrist.test", "Gizli-Sifre-1");
    expect(h.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("yanlış şifre: Türkçe hata, yönlendirme yok", async () => {
    h.signIn.mockRejectedValue(authErr("auth/invalid-credential"));
    render(<LoginPage />);
    await submitCredentials();
    expect(screen.getByRole("alert").textContent).toContain("E-posta adresi veya şifre hatalı.");
    expect(h.replace).not.toHaveBeenCalled();
  });

  it("MFA: ikinci adım açılır; kodu Identity Platform doğrular; yanlış kodda hata, doğru kodda giriş", async () => {
    h.signIn.mockRejectedValue(authErr("auth/multi-factor-auth-required"));
    render(<LoginPage />);
    await submitCredentials();

    expect(screen.getByRole("heading", { name: "İki aşamalı doğrulama" })).toBeTruthy();
    const code = screen.getByLabelText(/Doğrulama kodu/);
    expect(document.activeElement).toBe(code);
    expect(code.getAttribute("inputmode")).toBe("numeric");
    expect(code.getAttribute("autocomplete")).toBe("one-time-code");
    expect(h.replace).not.toHaveBeenCalled();

    h.resolveSignIn.mockRejectedValueOnce(authErr("auth/invalid-verification-code"));
    fireEvent.change(code, { target: { value: "000000" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Doğrula" }));
    });
    expect(screen.getByRole("alert").textContent).toContain("Doğrulama kodu hatalı");
    expect(h.replace).not.toHaveBeenCalled();

    h.resolveSignIn.mockResolvedValueOnce({});
    fireEvent.change(code, { target: { value: "123 456" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Doğrula" }));
    });
    expect(h.resolveSignIn).toHaveBeenLastCalledWith({ uid: "factor-1", code: "123456" });
    expect(h.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("eksik kod sunucuya gitmez", async () => {
    h.signIn.mockRejectedValue(authErr("auth/multi-factor-auth-required"));
    render(<LoginPage />);
    await submitCredentials();
    fireEvent.change(screen.getByLabelText(/Doğrulama kodu/), { target: { value: "12" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Doğrula" }));
    });
    expect(h.resolveSignIn).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("6 haneli");
  });

  it("ikinci adım oturumu dolarsa ilk adıma döner ve açıklar", async () => {
    h.signIn.mockRejectedValue(authErr("auth/multi-factor-auth-required"));
    h.resolveSignIn.mockRejectedValue(authErr("auth/invalid-multi-factor-session"));
    render(<LoginPage />);
    await submitCredentials();
    fireEvent.change(screen.getByLabelText(/Doğrulama kodu/), { target: { value: "123456" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Doğrula" }));
    });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Pediatrist'e giriş" })).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toContain("Doğrulama süresi doldu");
  });

  it("çıkış nedeni bildirimi (?neden=mfa-kuruldu → olumlu ton)", () => {
    window.history.replaceState(null, "", "/login?neden=mfa-kuruldu");
    render(<LoginPage />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("İki aşamalı doğrulama etkinleştirildi");
    expect(status.className).toContain("success");
  });
});
