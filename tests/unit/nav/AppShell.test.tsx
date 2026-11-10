// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClinicMemberSession } from "@/lib/auth/types";

const nav = vi.hoisted(() => ({ pathname: "/materials" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
// next/link yerine düz bağlantı; jsdom gerçek gezinme yapamadığı için varsayılan davranış engellenir.
vi.mock("next/link", () => ({
  default: ({ href, children, onClick, ...rest }: { href: string; children: ReactNode; onClick?: () => void }) => (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
}));

const { AppShell } = await import("@/components/nav/AppShell");
const { isActivePath, visibleNavItems } = await import("@/components/nav/navItems");

function session(role: "admin" | "user"): ClinicMemberSession {
  return {
    uid: "u1",
    email: "a@b.test",
    fullName: "Deneme Kişi",
    title: "Dr.",
    residencyYear: 2,
    role,
    status: "active",
    mfaVerified: false,
    mfaEnrolled: false,
    hasBoundDevice: false,
  };
}

beforeEach(() => {
  nav.pathname = "/materials";
});

describe("navItems", () => {
  it("aktif yol: tam eşleşme ve alt yollar; benzer önekler eşleşmez", () => {
    expect(isActivePath("/quizzes", "/quizzes")).toBe(true);
    expect(isActivePath("/quizzes/abc", "/quizzes")).toBe(true);
    expect(isActivePath("/quizzes-old", "/quizzes")).toBe(false);
    expect(isActivePath(null, "/quizzes")).toBe(false);
  });

  it("yönetim öğesi yalnızca admin'e", () => {
    expect(visibleNavItems("user").map((i) => i.key)).not.toContain("admin");
    expect(visibleNavItems("admin").map((i) => i.key)).toContain("admin");
  });
});

describe("AppShell", () => {
  it("aktif sayfa aria-current=page; rol bazlı etiket; asistan yönetim bağlantısını görmez", () => {
    render(
      <AppShell session={session("user")} onSignOut={async () => {}}>
        <h1>İçerik</h1>
      </AppShell>
    );
    const menu = screen.getByRole("navigation", { name: "Ana menü" });
    const active = within(menu).getByRole("link", { name: "Eğitim Materyalleri" });
    expect(active.getAttribute("aria-current")).toBe("page");
    expect(active.className).toContain("active");
    expect(within(menu).getByRole("link", { name: "Genel Bakış" }).hasAttribute("aria-current")).toBe(false);
    expect(within(menu).getByRole("link", { name: "Sınavlar" })).toBeTruthy();
    expect(within(menu).queryByRole("link", { name: "Üyeler ve Güvenlik" })).toBeNull();
    expect(screen.getByRole("link", { name: "İçeriğe geç" }).getAttribute("href")).toBe("#main-content");
    expect(screen.getByRole("main").id).toBe("main-content");
  });

  it("mobil çekmece: açılır, odak içeride, Esc kapatır ve odak Menü düğmesine döner", () => {
    render(
      <AppShell session={session("admin")} onSignOut={async () => {}}>
        <h1>İçerik</h1>
      </AppShell>
    );
    const toggle = screen.getByRole("button", { name: "Menü" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    toggle.focus();
    fireEvent.click(toggle);

    const drawer = screen.getByRole("dialog", { name: "Menü" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(drawer.contains(document.activeElement)).toBe(true);
    expect(within(drawer).getByRole("link", { name: "Sınav Yönetimi" })).toBeTruthy();
    expect(within(drawer).getByRole("link", { name: "Üyeler ve Güvenlik" })).toBeTruthy();
    expect(screen.getByRole("main").closest("[inert]")).not.toBeNull();

    fireEvent.keyDown(drawer, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it("çekmecede bağlantıya tıklayınca ve sayfa değişince çekmece kapanır", () => {
    const { rerender } = render(
      <AppShell session={session("admin")} onSignOut={async () => {}}>
        <p />
      </AppShell>
    );
    fireEvent.click(screen.getByRole("button", { name: "Menü" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Ders Yoklaması" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Menü" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    nav.pathname = "/attendance";
    act(() =>
      rerender(
        <AppShell session={session("admin")} onSignOut={async () => {}}>
          <p />
        </AppShell>
      )
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("çıkış hatası kullanıcıya gösterilir", async () => {
    const onSignOut = vi.fn().mockRejectedValue(new Error("x"));
    render(
      <AppShell session={session("user")} onSignOut={onSignOut}>
        <p />
      </AppShell>
    );
    const [desktopSignOut] = screen.getAllByRole("button", { name: "Güvenli Çıkış" });
    await act(async () => {
      fireEvent.click(desktopSignOut);
    });
    expect(onSignOut).toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Beklenmeyen bir hata");
  });
});
