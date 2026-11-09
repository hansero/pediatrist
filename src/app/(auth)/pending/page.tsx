"use client";

import React from "react";

export default function PendingApprovalPage() {
  return (
    <main className="auth-screen">
      <article className="auth-card" aria-labelledby="pending-approval-heading">
        <span className="sec-chip warn">Custom Claims: status = &quot;pending&quot;</span>
        <h1 id="pending-approval-heading" style={{ marginTop: "0.75rem" }}>
          Üyeliğiniz Eğitim Sorumlusu Onayı Bekliyor
        </h1>
        <p className="page-header-subtitle" style={{ marginTop: "0.5rem" }}>
          Pediatrist platformuna yalnızca onaylı klinik üyeleri erişebilir. Başvurunuz Admin panelinde (
          <code>/admin</code>) onaylandığında 2FA ile giriş yapabilirsiniz.
        </p>
      </article>
    </main>
  );
}
