"use client";

import React, { useState } from "react";
import { TrainingMaterialItem } from "./WatermarkedMaterialViewer";

interface AdminMaterialManagerProps {
  materials: TrainingMaterialItem[];
  onUploadMaterial: (newItem: Omit<TrainingMaterialItem, "id" | "createdAt" | "readerStats">) => void;
  onToggleAllowDownload: (materialId: string) => void;
}

/**
 * Admin Eğitim Materyali Yükleme, Kıdem/Bilim Dalı Etiketleme,
 * İndirme İzni Kısıtlama (allowDownload) ve Asistan Okunma Raporu Bileşeni.
 */
export function AdminMaterialManager({
  materials,
  onUploadMaterial,
  onToggleAllowDownload,
}: AdminMaterialManagerProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Çocuk Acil & Yoğun Bakım");
  const [fileType, setFileType] = useState<"pdf" | "slides" | "video">("pdf");
  const [targetYears, setTargetYears] = useState<number[]>([1, 2, 3, 4]);
  const [isMandatory, setIsMandatory] = useState(true);
  const [allowDownload, setAllowDownload] = useState(false);
  const [contentSlide1, setContentSlide1] = useState("");

  const toggleYear = (yr: number) => {
    setTargetYears((prev) =>
      prev.includes(yr) ? prev.filter((y) => y !== yr) : [...prev, yr].sort()
    );
  };

  return (
    <div className="grid-2">
      <article className="surface-card" aria-labelledby="admin-upload-material-heading">
        <h2 id="admin-upload-material-heading" style={{ marginBottom: "0.75rem" }}>
          Yeni Eğitim Materyali Yükle (Firebase Cloud Storage)
        </h2>
        <form
          id="admin-upload-material-form"
          onSubmit={(e) => {
            e.preventDefault();
            onUploadMaterial({
              title,
              description,
              category,
              targetYears: targetYears.length ? targetYears : [1, 2, 3, 4],
              isMandatory,
              fileType,
              allowDownload,
              storagePath: `materials/${category.toLowerCase().replace(/\s+/g, "_")}/${Date.now()}.${fileType}`,
              uploadedBy: "Prof. Dr. Selim Kaya",
              clinicalSummaryPages: [
                contentSlide1 || "Klinik kılavuz özeti ve tanı/tedavi algoritması.",
              ],
            });
            setTitle("");
            setDescription("");
            setContentSlide1("");
          }}
        >
          <div className="form-group">
            <label htmlFor="mat-title-input" className="form-label">
              Materyal Başlığı
            </label>
            <input
              id="mat-title-input"
              type="text"
              className="form-input"
              placeholder="Örn: 2026 Pediatrik Septik Şok 1. Saat Paketi"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="mat-category-select" className="form-label">
              Bilim Dalı / Kategori
            </label>
            <select
              id="mat-category-select"
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="Çocuk Acil & Yoğun Bakım">Çocuk Acil &amp; Yoğun Bakım</option>
              <option value="Neonatoloji (Yenidoğan)">Neonatoloji (Yenidoğan)</option>
              <option value="Çocuk Enfeksiyon">Çocuk Enfeksiyon</option>
              <option value="Çocuk Nefroloji & Sıvı">Çocuk Nefroloji &amp; Sıvı</option>
              <option value="Çocuk Kardiyoloji">Çocuk Kardiyoloji</option>
              <option value="Genel Pediatri">Genel Pediatri</option>
            </select>
          </div>

          <div className="form-group">
            <span className="form-label">Hedef Asistan Kıdem Yılları</span>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {[1, 2, 3, 4].map((yr) => (
                <button
                  key={yr}
                  id={`mat-year-toggle-${yr}`}
                  type="button"
                  className={`btn btn-sm ${targetYears.includes(yr) ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => toggleYear(yr)}
                >
                  {yr}. Yıl Asistanı
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="mat-content-textarea" className="form-label">
              Klinik İçerik / Slayt Metni
            </label>
            <textarea
              id="mat-content-textarea"
              className="form-textarea"
              rows={3}
              placeholder="Görüntüleyicide filigran altında gösterilecek klinik ders özeti..."
              value={contentSlide1}
              onChange={(e) => setContentSlide1(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.84rem" }}>
              <input
                id="mat-mandatory-checkbox"
                type="checkbox"
                checked={isMandatory}
                onChange={(e) => setIsMandatory(e.target.checked)}
              />
              Zorunlu Müfredat Materyali
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.84rem" }}>
              <input
                id="mat-allow-download-checkbox"
                type="checkbox"
                checked={allowDownload}
                onChange={(e) => setAllowDownload(e.target.checked)}
              />
              Dışarıya İndirmeye İzin Ver (allowDownload)
            </label>
          </div>

          <button id="mat-submit-upload-btn" type="submit" className="btn btn-primary" style={{ width: "100%" }}>
            Firebase Storage&apos;a Yükle ve Yayınla
          </button>
        </form>
      </article>

      <article className="surface-card" aria-labelledby="admin-readership-report-heading">
        <h2 id="admin-readership-report-heading" style={{ marginBottom: "0.75rem" }}>
          Klinik Materyal Okunma ve DRM Raporu
        </h2>
        <div className="table-wrap">
          <table class="clinical-table">
            <thead>
              <tr>
                <th>Materyal</th>
                <th>Hedef Kıdem</th>
                <th>DRM / İndirme</th>
                <th>Tamamlayan Hekim</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => {
                const readers = Object.values(m.readerStats || {});
                const completedCount = readers.filter((r) => r.completed).length;
                return (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.title}</strong>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{m.category}</div>
                    </td>
                    <td className="mono-num">{m.targetYears.join(", ")}. Yıl</td>
                    <td>
                      <button
                        id={`toggle-drm-btn-${m.id}`}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onToggleAllowDownload(m.id)}
                      >
                        {m.allowDownload ? "İndirme Açık" : "Kilitli (Filigran)"}
                      </button>
                    </td>
                    <td className="mono-num">
                      {completedCount} / {readers.length} Hekim
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
