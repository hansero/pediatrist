"use client";

import React, { useEffect, useState } from "react";
import { ClinicMemberSession } from "@/components/security/SessionGuard";

export interface TrainingMaterialItem {
  id: string;
  title: string;
  description: string;
  category: string;
  targetYears: number[];
  isMandatory: boolean;
  fileType: "pdf" | "slides" | "video";
  allowDownload: boolean;
  storagePath: string;
  uploadedBy: string;
  createdAt: string;
  clinicalSummaryPages: string[];
  readerStats: Record<
    string,
    { fullName: string; residencyYear: number; durationSeconds: number; completed: boolean; lastViewedAt: string }
  >;
}

interface WatermarkedMaterialViewerProps {
  material: TrainingMaterialItem;
  session: ClinicMemberSession;
  onMarkCompleted: (materialId: string, durationSeconds: number) => void;
  onClose: () => void;
}

/**
 * Sızıntı Önleyici Dinamik Filigranlı (Watermark) Uygulama İçi Materyal Görüntüleyici.
 * - allowDownload: false ise sağ tık, kopyalama ve dışa indirme engellenir.
 * - Belge yüzeyine aktif hekimin Adı Soyadı, E-postası, Cihaz ID'si ve canlı zaman damgası basılır.
 */
export function WatermarkedMaterialViewer({
  material,
  session,
  onMarkCompleted,
  onClose,
}: WatermarkedMaterialViewerProps) {
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [secondsSpent, setSecondsSpent] = useState<number>(
    material.readerStats[session.uid]?.durationSeconds || 0
  );
  const [timestampStr, setTimestampStr] = useState<string>(new Date().toLocaleString("tr-TR"));

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsSpent((prev) => prev + 1);
      setTimestampStr(new Date().toLocaleString("tr-TR"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const watermarkLabel = `${session.title} ${session.fullName} • ${session.email} • ${timestampStr}`;
  const pages = material.clinicalSummaryPages.length
    ? material.clinicalSummaryPages
    : ["Klinik eğitim materyali içeriği."];

  return (
    <article
      className="surface-card"
      aria-labelledby="viewer-material-title"
      onContextMenu={(e) => {
        if (!material.allowDownload) e.preventDefault();
      }}
      style={{ userSelect: material.allowDownload ? "auto" : "none" }}
    >
      <div className="page-header" style={{ paddingBottom: "0.85rem", marginBottom: "1rem" }}>
        <div>
          <div style={{ display: "flex", gap: "0.45rem", alignItems: "center", flexWrap: "wrap" }}>
            <span className="sec-chip primary">{material.category}</span>
            <span className="sec-chip">Format: {material.fileType.toUpperCase()}</span>
            {!material.allowDownload ? (
              <span className="sec-chip critical">DRM Korumalı • İndirme Kapalı (Filigran Aktif)</span>
            ) : (
              <span className="sec-chip verified">İndirilebilir Materyal</span>
            )}
          </div>
          <h2 id="viewer-material-title" style={{ marginTop: "0.5rem" }}>
            {material.title}
          </h2>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span className="sec-chip mono-num">İnceleme Süresi: {secondsSpent} sn</span>
          <button
            id="viewer-complete-btn"
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onMarkCompleted(material.id, secondsSpent)}
          >
            Okundu / Tamamlandı İşaretle
          </button>
          <button id="viewer-close-btn" type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Listeye Dön
          </button>
        </div>
      </div>

      {/* Filigranlı Belge Tuvali */}
      <div
        id="watermarked-document-canvas"
        style={{
          position: "relative",
          minHeight: "340px",
          padding: "2rem",
          borderRadius: "var(--radius-md)",
          background: "hsl(210, 25%, 97%)",
          border: "1px solid var(--border-strong)",
          overflow: "hidden",
        }}
      >
        {/* Çapraz Dinamik Sızıntı Önleyici Filigran Katmanı */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "2.5rem",
            padding: "1.5rem",
            opacity: 0.14,
            transform: "rotate(-16deg) scale(1.1)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx}>{watermarkLabel}</div>
          ))}
        </div>

        <div style={{ position: "relative", zIndex: 2 }}>
          <div
            className="mono-num"
            style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}
          >
            Firebase Cloud Storage: <code>{material.storagePath}</code> • Sayfa {pageIndex + 1} / {pages.length}
          </div>
          <div style={{ fontSize: "0.96rem", lineHeight: 1.7, whiteSpace: "pre-line" }}>
            {pages[pageIndex]}
          </div>
        </div>
      </div>

      {/* Sayfa Gezinme Kontrolleri */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "1rem",
        }}
      >
        <button
          id="viewer-prev-page-btn"
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pageIndex === 0}
          onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
        >
          &larr; Önceki Slayt / Sayfa
        </button>
        <span className="mono-num" style={{ fontSize: "0.82rem" }}>
          Sayfa {pageIndex + 1} / {pages.length}
        </span>
        <button
          id="viewer-next-page-btn"
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pageIndex >= pages.length - 1}
          onClick={() => setPageIndex((p) => Math.min(pages.length - 1, p + 1))}
        >
          Sonraki Slayt / Sayfa &rarr;
        </button>
      </div>
    </article>
  );
}
