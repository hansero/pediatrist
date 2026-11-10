import Link from "next/link";

/** Bilinmeyen adres (F3.2). Korumalı alan dışında çizilir; oturum durumunu bilmez. */
export default function NotFound() {
  return (
    <main className="auth-screen">
      <div className="auth-card status-page">
        <h1>Sayfa bulunamadı</h1>
        <p className="page-header-subtitle">Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.</p>
        <Link href="/dashboard" className="btn btn-primary">
          Genel bakışa dön
        </Link>
      </div>
    </main>
  );
}
