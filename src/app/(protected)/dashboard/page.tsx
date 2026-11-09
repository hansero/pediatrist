"use client";

import React from "react";
import { useClinicSession } from "@/lib/auth/ClinicSessionContext";

/**
 * Klinik Ana Gösterge Paneli (/dashboard)
 * - Eğitim Sorumlusu (Admin - Prof. Dr. Pediatrist) ve Pediatri Asistanı (User - Pediatric Resident)
 *   için rol duyarlı klinik özet ve tek tıkla modül geçiş kartları sunar.
 */
export default function DashboardPage() {
  const { session } = useClinicSession();
  const isAdmin = session?.role === "admin";

  return (
    <section
      aria-labelledby="dashboard-main-heading"
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
    >
      <div className="page-header">
        <div>
          <span className="sec-chip verified">
            {isAdmin ? "Eğitim Sorumlusu Yönetim Görünümü" : "Pediatri Asistanı Klinik Eğitim Görünümü"}
          </span>
          <h1 id="dashboard-main-heading" style={{ marginTop: "0.45rem" }}>
            {session ? `Hoş Geldiniz, ${session.title} ${session.fullName}` : "Pediatri Eğitim Kliniği Gösterge Paneli"}
          </h1>
          <p className="page-header-subtitle">
            {isAdmin
              ? "Sabah vaka yoklamalarını başlatabilir, 9 sütunlu CSV ile yeni klinik vaka sınavı yayınlayabilir ve asistan gelişim/katılım raporlarını inceleyebilirsiniz."
              : "Aktif sabah dersi yoklamasına katılabilir, haftalık klinik vaka sınavınızı çözebilir ve zorunlu eğitim rehberlerinizi takip edebilirsiniz."}
          </p>
        </div>
      </div>

      {/* Üst Klinik Özet Kartları */}
      <div className="grid-4">
        <article className="metric-card">
          <span className="metric-label">Sabah Dersi &amp; Yoklama</span>
          <span className="metric-value mono-num">Canlı Ders Açık</span>
          <span className="metric-foot">Kawasaki &amp; MIS-C Olgu Sunumu</span>
        </article>
        <article className="metric-card">
          <span className="metric-label">Haftalık Vaka Sınavı</span>
          <span className="metric-value mono-num">15 Dk • 3 Vaka</span>
          <span className="metric-foot">Çocuk Acil &amp; Solunum Acilleri</span>
        </article>
        <article className="metric-card">
          <span className="metric-label">Klinik Eğitim Rehberleri</span>
          <span className="metric-value mono-num">3 Kılavuz</span>
          <span className="metric-foot">2 Zorunlu Okuma Materyali</span>
        </article>
        <article className="metric-card">
          <span className="metric-label">{isAdmin ? "Onay Bekleyen Başvuru" : "Kişisel Sınav Ortalamam"}</span>
          <span className="metric-value mono-num">{isAdmin ? "1 Hekim" : "76 / 100"}</span>
          <span className="metric-foot">{isAdmin ? "Üye & Güvenlik Panelinde" : "Son 2 Sınav Ortalaması"}</span>
        </article>
      </div>

      {/* Hızlı Klinik Eylem Kartları */}
      <div className="grid-2">
        <article
          className="surface-card"
          style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1rem" }}
        >
          <div>
            <span className="sec-chip primary">Modül 3 • Derslere Katılım Kontrolü</span>
            <h2 style={{ marginTop: "0.45rem" }}>
              {isAdmin ? "Sabah Vaka Dersi Başlat & Katılım Raporlarını İncele" : "Canlı Ders Yoklamasına Katıl"}
            </h2>
            <p className="page-header-subtitle" style={{ marginTop: "0.35rem" }}>
              {isAdmin
                ? "Yoklama alınacak dersi başlatın, projektöre 15 saniyede bir yenilenen doğrulama kodunu yansıtın ve ders/asistan bazlı katılım istatistiklerini inceleyin."
                : "Eğitim Sorumlusu tarafından başlatılan derse kayıtlı kişisel cihazınız ve projektördeki 6 haneli kod ile yoklama verin."}
            </p>
          </div>
          <a
            id="dashboard-goto-attendance-btn"
            href="/attendance"
            className="btn btn-primary"
            style={{ textAlign: "center", textDecoration: "none" }}
          >
            {isAdmin ? "Ders Başlatma ve Katılım Raporları Ekranını Aç" : "Ders Yoklama Ekranına Git"}
          </a>
        </article>

        <article
          className="surface-card"
          style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1rem" }}
        >
          <div>
            <span className="sec-chip primary">Modül 4 • Online Vaka Sınavları</span>
            <h2 style={{ marginTop: "0.45rem" }}>
              {isAdmin
                ? "CSV ile Vaka Sınavı Yükle, Önizle ve Sonuçları İzle"
                : "Aktif Vaka Sınavına Katıl ve Karnelerimi Gör"}
            </h2>
            <p className="page-header-subtitle" style={{ marginTop: "0.35rem" }}>
              {isAdmin
                ? "9 sütunlu CSV dosyasını yükleyip soruları önizleyin, sınav süresini belirleyerek yayına alın ve tüm asistanların sınav sonuçlarını karşılaştırın."
                : "Yayındaki klinik vaka sınavını çözün, sınav sonunda her vakanın klinik öğrenme noktasını inceleyin ve gelişim grafiğinizi takip edin."}
            </p>
          </div>
          <a
            id="dashboard-goto-quizzes-btn"
            href="/quizzes"
            className="btn btn-primary"
            style={{ textAlign: "center", textDecoration: "none" }}
          >
            {isAdmin ? "Sınav Yönetimi ve Analitik Paneline Git" : "Online Sınav ve Gelişim Panelime Git"}
          </a>
        </article>
      </div>

      <div className="grid-2">
        <article
          className="surface-card"
          style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1rem" }}
        >
          <div>
            <span className="sec-chip verified">Modül 1 • Eğitim Materyalleri</span>
            <h2 style={{ marginTop: "0.45rem" }}>Klinik Kılavuzlar ve Ders Sunumları</h2>
            <p className="page-header-subtitle" style={{ marginTop: "0.35rem" }}>
              Çocuk Acil, Yenidoğan ve Enfeksiyon kılavuzlarını kıdem yılınıza göre filtreleyin ve uygulama içi
              filigranlı görüntüleyicide inceleyin.
            </p>
          </div>
          <a
            id="dashboard-goto-materials-btn"
            href="/materials"
            className="btn btn-secondary"
            style={{ textAlign: "center", textDecoration: "none" }}
          >
            Eğitim Materyalleri Kütüphanesini Aç
          </a>
        </article>

        <article
          className="surface-card"
          style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1rem" }}
        >
          <div>
            <span className="sec-chip warn">Modül 2 • Pediatri Hesaplamaları</span>
            <h2 style={{ marginTop: "0.45rem" }}>Sıvı, Doz, Neonatoloji ve Skorlama Araçları</h2>
            <p className="page-header-subtitle" style={{ marginTop: "0.35rem" }}>
              Holliday-Segar sıvı, PALS acil resüsitasyon dozları, yenidoğan bilirubin ve klinik skorlama modüllerini
              görüntüleyin.
            </p>
          </div>
          <a
            id="dashboard-goto-calculators-btn"
            href="/calculators"
            className="btn btn-secondary"
            style={{ textAlign: "center", textDecoration: "none" }}
          >
            Pediatri Hesaplayıcılarını Görüntüle
          </a>
        </article>
      </div>
    </section>
  );
}
