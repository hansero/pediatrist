// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClinicMemberSession } from "@/lib/auth/types";
import { KVKK_NOTICE_VERSION } from "@shared/consent";

// Yalnızca testte: Firebase SDK, QR üretici ve oturum bağlamı.
const h = vi.hoisted(() => ({
  session: null as ClinicMemberSession | null,
  signOutUser: vi.fn(),
  enroll: vi.fn(),
  generateSecret: vi.fn(),
  sendEmailVerification: vi.fn(),
  emulators: false,
  user: { uid: "u1", email: "dr@pediatrist.test", emailVerified: true, reload: vi.fn(), getIdToken: vi.fn() },
}));
vi.mock("@/lib/auth/ClinicSessionContext", () => ({
  useClinicSession: () => ({ session: h.session, signOutUser: h.signOutUser }),
}));
vi.mock("@/lib/firebase/client", () => ({
  initPediatristFirebase: () => ({ auth: { currentUser: h.user } }),
  isUsingEmulators: () => h.emulators,
}));
const downloadMemberExport = vi.fn();
vi.mock("@/lib/privacy", () => ({ downloadMemberExport: (uid: string) => downloadMemberExport(uid) }));
const toastShow = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ show: toastShow }) }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,QR") } }));
vi.mock("firebase/auth", () => ({
  sendEmailVerification: h.sendEmailVerification,
  getMultiFactorResolver: vi.fn(),
  multiFactor: () => ({ getSession: vi.fn().mockResolvedValue("s"), enroll: h.enroll, enrolledFactors: [] }),
  TotpMultiFactorGenerator: {
    FACTOR_ID: "totp",
    generateSecret: h.generateSecret,
    assertionForEnrollment: (secret: unknown, code: string) => ({ secret, code }),
  },
}));

const { default: AccountSecurityPage } = await import("@/app/(protected)/account/security/page");

function session(overrides: Partial<ClinicMemberSession> = {}): ClinicMemberSession {
  return {
    uid: "u1",
    email: "dr@pediatrist.test",
    fullName: "Deneme",
    title: "Dr.",
    residencyYear: 2,
    role: "user",
    status: "active",
    mfaVerified: false,
    mfaEnrolled: false,
    emailVerified: true,
    mfaRequired: true,
    emailVerificationRequired: false,
    consentVersion: KVKK_NOTICE_VERSION,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.emulators = false;
  h.signOutUser.mockResolvedValue(undefined);
  h.generateSecret.mockResolvedValue({
    secretKey: "ABCDEFGHIJKLMNOP",
    generateQrCodeUrl: () => "otpauth://totp/Pediatrist:dr@pediatrist.test",
  });
});

describe("Hesap güvenliği", () => {
  it("kurulum: QR ve gruplu anahtar; yanlış biçimli kod gönderilmez; doğru kodla kayıt + nedenli çıkış", async () => {
    h.session = session();
    render(<AccountSecurityPage />);
    expect(screen.getByRole("status").textContent).toContain("İki aşamalı doğrulama gerekli");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kurulumu başlat" }));
    });
    expect(screen.getByRole("img", { name: /kurulum QR kodu/ }).getAttribute("src")).toBe("data:image/png;base64,QR");
    expect(screen.getByText("ABCD EFGH IJKL MNOP")).toBeTruthy();

    const code = screen.getByLabelText(/Doğrulama kodu/);
    fireEvent.change(code, { target: { value: "12" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Doğrula ve etkinleştir" }));
    });
    expect(h.enroll).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").some((a) => a.textContent?.includes("6 haneli"))).toBe(true);

    h.enroll.mockResolvedValue(undefined);
    fireEvent.change(code, { target: { value: "123456" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Doğrula ve etkinleştir" }));
    });
    expect(h.enroll).toHaveBeenCalledWith(expect.objectContaining({ code: "123456" }), "Authenticator");
    expect(h.signOutUser).toHaveBeenCalledWith("mfa-kuruldu");
  });

  it("sunucu kodu reddederse hata gösterilir, çıkış yapılmaz", async () => {
    h.session = session();
    h.enroll.mockRejectedValue(Object.assign(new Error("x"), { code: "auth/invalid-verification-code" }));
    render(<AccountSecurityPage />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kurulumu başlat" }));
    });
    fireEvent.change(screen.getByLabelText(/Doğrulama kodu/), { target: { value: "000000" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Doğrula ve etkinleştir" }));
    });
    expect(screen.getAllByRole("alert").some((a) => a.textContent?.includes("Doğrulama kodu hatalı"))).toBe(true);
    expect(h.signOutUser).not.toHaveBeenCalled();
  });

  it("e-posta doğrulanmamışsa önce doğrulama istenir; kurulum düğmesi yok", async () => {
    h.session = session({ emailVerified: false });
    h.sendEmailVerification.mockResolvedValue(undefined);
    render(<AccountSecurityPage />);
    expect(screen.queryByRole("button", { name: "Kurulumu başlat" })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Doğrulama e-postası gönder" }));
    });
    expect(h.sendEmailVerification).toHaveBeenCalledWith(h.user);
    expect(screen.getByText(/Doğrulama bağlantısı gönderildi/)).toBeTruthy();
  });

  it("emülatörde kurulum yerine açıklama gösterilir", () => {
    h.session = session();
    h.emulators = true;
    render(<AccountSecurityPage />);
    expect(screen.queryByRole("button", { name: "Kurulumu başlat" })).toBeNull();
    expect(screen.getByText(/emülatöründe desteklenmiyor/)).toBeTruthy();
  });

  it("kayıtlıysa 'Etkin'; zorunluyken kaldırma düğmesi yok", () => {
    h.session = session({ mfaEnrolled: true });
    render(<AccountSecurityPage />);
    expect(screen.getByText("Etkin")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Kaldır" })).toBeNull();
  });

  it("kişisel verilerim (F9.1): döküm kendi uid'i için istenir; başarı yalnızca yanıttan sonra, hata gösterilir", async () => {
    h.session = session({ mfaEnrolled: true });
    downloadMemberExport.mockRejectedValueOnce(new Error("ağ"));
    render(<AccountSecurityPage />);
    expect(screen.getByText(new RegExp(`sürümü: ${KVKK_NOTICE_VERSION.replace(".", "\\.")}`))).toBeTruthy();
    const button = screen.getByRole("button", { name: "Verilerimi indir" });

    await act(async () => fireEvent.click(button));
    expect(downloadMemberExport).toHaveBeenCalledWith("u1");
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(toastShow).not.toHaveBeenCalled();

    downloadMemberExport.mockResolvedValueOnce({});
    await act(async () => fireEvent.click(button));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(toastShow).toHaveBeenCalledWith("Veri dökümünüz indirildi.", { tone: "success" });
  });
});
