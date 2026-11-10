"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { ClinicMemberSession } from "@/lib/auth/types";
import { DEVICE_PAGE, isActivePath, SECURITY_PAGE, visibleNavItems } from "./navItems";

interface AppShellProps {
  session: ClinicMemberSession;
  onSignOut: () => Promise<void>;
  children: ReactNode;
}

/** Kenar çubuğundaki rol satırı: eğitim sorumlusu, asistan (kıdem yılıyla) veya uzman hekim. */
export function memberRoleLabel(session: Pick<ClinicMemberSession, "role" | "residencyYear">): string {
  if (session.role === "admin") return "Eğitim Sorumlusu";
  return session.residencyYear ? `Asistan • ${session.residencyYear}. yıl` : "Uzman hekim";
}

function Brand() {
  return (
    <div className="brand-header">
      <div className="brand-mark" aria-hidden="true">
        P
      </div>
      <div>
        <span className="brand-title">Pediatrist</span>
        <span className="brand-subtitle">Eğitim Kliniği Platformu</span>
      </div>
    </div>
  );
}

function NavLinks({
  session,
  idPrefix,
  onNavigate,
}: {
  session: ClinicMemberSession;
  idPrefix: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Ana menü">
      <ul className="nav-list">
        {visibleNavItems(session.role).map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.key}>
              <Link
                id={`${idPrefix}-${item.key}`}
                href={item.href}
                className={active ? "nav-link active" : "nav-link"}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
              >
                <span className="nav-link-inner">{item.labelFor?.[session.role] ?? item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function UserFooter({ session, onSignOut }: Pick<AppShellProps, "session" | "onSignOut">) {
  const signOut = useAsyncAction(onSignOut);
  return (
    <div className="sidebar-footer">
      <div className="user-pill">
        <div className="user-pill-name">
          {session.title} {session.fullName}
        </div>
        <div className="user-pill-meta">{memberRoleLabel(session)}</div>
        <div className="user-pill-links">
          <Link href={SECURITY_PAGE} className="user-pill-link">
            Hesap güvenliği
          </Link>
          <Link href={DEVICE_PAGE} className="user-pill-link">
            Yoklama cihazı
          </Link>
        </div>
      </div>
      {signOut.error && (
        <p role="alert" className="ui-field-error">
          {signOut.error}
        </p>
      )}
      <Button
        variant="secondary"
        size="sm"
        loading={signOut.pending}
        loadingText="Çıkış yapılıyor…"
        onClick={() => signOut.run()}
      >
        Güvenli Çıkış
      </Button>
    </div>
  );
}

/**
 * Korumalı alan iskeleti (F3.2):
 * - `next/link` ile istemci tarafı gezinme (sayfa yeniden yüklenmez, oturum yeniden doğrulanmaz).
 * - Aktif menü öğesi `aria-current="page"` + `.active`.
 * - ≤960 px: üst çubuk + "Menü" düğmesi → kipli çekmece (odak tuzağı, Esc); sayfa değişince kapanır.
 * - "İçeriğe geç" bağlantısı (WCAG 2.4.1).
 */
export function AppShell({ session, onSignOut, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <a href="#main-content" className="skip-link">
        İçeriğe geç
      </a>
      <div className="app-shell">
        <aside className="app-sidebar app-sidebar--desktop" aria-label="Kenar çubuğu">
          <div>
            <Brand />
            <NavLinks session={session} idPrefix="nav-link" />
          </div>
          <UserFooter session={session} onSignOut={onSignOut} />
        </aside>

        <div className="app-main-wrapper">
          <header className="mobile-topbar">
            <Brand />
            <Button
              variant="secondary"
              size="sm"
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              onClick={() => setMenuOpen(true)}
            >
              Menü
            </Button>
          </header>
          <main id="main-content" className="app-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} label="Menü" className="app-sidebar">
        <div>
          <div className="ui-drawer-header">
            <Brand />
            <button type="button" className="ui-icon-btn" aria-label="Menüyü kapat" onClick={() => setMenuOpen(false)}>
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <NavLinks session={session} idPrefix="drawer-nav-link" onNavigate={() => setMenuOpen(false)} />
        </div>
        <UserFooter session={session} onSignOut={onSignOut} />
      </Drawer>
    </>
  );
}
