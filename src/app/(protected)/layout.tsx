"use client";

import React from "react";
import { SessionGuard } from "@/components/security/SessionGuard";
import { ClinicSessionProvider, useClinicSession } from "@/lib/auth/ClinicSessionContext";
import "@/styles/index.css";

/**
 * Korumalı alan iskeleti.
 * GÜVENLİK: Uygulama içi "Rol Değiştir" butonu KALDIRILDI. Rol yalnızca Firebase Custom Claims'ten
 * gelir. Kenar çubuğunda cihaz kimliği, proje kimliği veya token claim'leri gösterilmez.
 */
function ClinicShell({ children }: { children: React.ReactNode }) {
  const { session, loading, signOutUser } = useClinicSession();

  if (loading) {
    return (
      <main className="app-content" aria-busy="true">
        <p className="page-header-subtitle">Oturum doğrulanıyor…</p>
      </main>
    );
  }

  if (!session) {
    if (typeof window !== "undefined") window.location.replace("/login");
    return null;
  }

  return (
    <SessionGuard session={session} onUnlock={() => false} onSignOut={signOutUser}>
      <div className="app-shell">
        <aside className="app-sidebar" aria-label="Klinik Ana Navigasyon">
          <div>
            <div className="brand-header">
              <div className="brand-mark">P</div>
              <div>
                <span className="brand-title">Pediatrist</span>
                <span className="brand-subtitle">Eğitim Kliniği Platformu</span>
              </div>
            </div>

            <div className="nav-section-label">Klinik Eğitim Modülleri</div>
            <ul className="nav-list">
              <li>
                <a id="nav-link-dashboard" href="/dashboard" className="nav-link">
                  <span className="nav-link-inner">Genel Bakış</span>
                </a>
              </li>
              <li>
                <a id="nav-link-materials" href="/materials" className="nav-link">
                  <span className="nav-link-inner">1. Eğitim Materyalleri</span>
                </a>
              </li>
              <li>
                <a id="nav-link-calculators" href="/calculators" className="nav-link">
                  <span className="nav-link-inner">2. Pediatri Hesaplamaları</span>
                </a>
              </li>
              <li>
                <a id="nav-link-attendance" href="/attendance" className="nav-link">
                  <span className="nav-link-inner">3. Ders Katılım Kontrolü</span>
                </a>
              </li>
              <li>
                <a id="nav-link-quizzes" href="/quizzes" className="nav-link">
                  <span className="nav-link-inner">
                    {session.role === "admin" ? "4. Sınav Yönetimi" : "4. Online Sınav"}
                  </span>
                </a>
              </li>
              {session.role === "admin" && (
                <li>
                  <a id="nav-link-admin" href="/admin" className="nav-link">
                    <span className="nav-link-inner">5. Üye &amp; Güvenlik</span>
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div className="sidebar-footer">
            <div className="user-pill">
              <div className="user-pill-name">
                {session.title} {session.fullName}
              </div>
              <div className="user-pill-meta">
                {session.role === "admin" ? "Eğitim Sorumlusu" : `Asistan • ${session.residencyYear}. yıl`}
              </div>
            </div>
            <button id="sidebar-signout-btn" type="button" className="btn btn-secondary btn-sm" onClick={signOutUser}>
              Güvenli Çıkış
            </button>
          </div>
        </aside>

        <div className="app-main-wrapper">
          <main className="app-content">{children}</main>
        </div>
      </div>
    </SessionGuard>
  );
}

export default function ProtectedClinicalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClinicSessionProvider>
      <ClinicShell>{children}</ClinicShell>
    </ClinicSessionProvider>
  );
}
