"use client";

import React, { useState } from "react";
import { WatermarkedMaterialViewer, TrainingMaterialItem } from "@/components/materials/WatermarkedMaterialViewer";
import { AdminMaterialManager } from "@/components/materials/AdminMaterialManager";
import { useClinicSession } from "@/lib/auth/ClinicSessionContext";
import type { ClinicMemberSession } from "@/lib/auth/types";

const INITIAL_MATERIALS: TrainingMaterialItem[] = [
  {
    id: "mat_pals_sepsis_2026",
    title: "Pediatrik Septik Şok ve İlk 1 Saat Sıvı-İnotrop Yönetimi Kılavuzu",
    category: "Çocuk Acil & Yoğun Bakım",
    targetYears: [1, 2, 3, 4],
    isMandatory: true,
    fileType: "pdf",
    allowDownload: false,
    storagePath: "materials/cocuk_acil/mat_pals_sepsis_2026.pdf",
    uploadedBy: "Prof. Dr. Selim Kaya",
    description:
      "Çocuk acil serviste septik şok tanısı, 10–20 mL/kg dengeli kristalloid bolus ilkeleri, sıvıya dirençli şokta adrenalin/noradrenalin infüzyonu.",
    createdAt: "2026-11-01",
    clinicalSummaryPages: [
      "SAYFA 1 — TANIM VE İLK 5 DAKİKA: Çocukta taşikardi, kapiller dolum uzaması (>2 sn), mental durum değişikliği ve periferik nabız farkı varlığında hipotansiyon beklenmeden kompanse septik şok protokolü başlatılır.",
      "SAYFA 2 — SIVI RESÜSİTASYONU: İlk 15–60 dakikada 10–20 mL/kg izotonik dengeli kristalloid bolus uygulanır. Her bolus sonrası hepatomegali, akciğer bazallerinde ral ve solunum işi artışı mutlaka yeniden değerlendirilir.",
      "SAYFA 3 — VAZOAKTİF İNFÜZYON: 40–60 mL/kg sıvıya rağmen hipoperfüzyon sürüyorsa periferik veya santral yoldan Adrenalin (0.05–0.3 mcg/kg/dk) ya da sıcak şok bulgularında Noradrenalin başlanır.",
    ],
    readerStats: {
      uid_user_1: {
        fullName: "Asistan Dr. Elif Demir",
        residencyYear: 2,
        durationSeconds: 420,
        completed: true,
        lastViewedAt: "2026-11-04 14:20",
      },
    },
  },
  {
    id: "mat_nrp_preterm_2026",
    title: "Doğumhanede İleri Derecede Prematüre (<28 Hafta) Yenidoğan Stabilizasyonu",
    category: "Neonatoloji (Yenidoğan)",
    targetYears: [1, 2],
    isMandatory: true,
    fileType: "pdf",
    allowDownload: false,
    storagePath: "materials/neonatoloji/mat_nrp_preterm_2026.pdf",
    uploadedBy: "Doç. Dr. Ayşe Aksoy",
    description:
      "Polietilen örtü ile termoregülasyon, T-parçalı resüsitatör ile PEEP/CPAP uygulaması, başlangıç FiO2 titrasyonu ve erken sürfaktan endikasyonları.",
    createdAt: "2026-11-03",
    clinicalSummaryPages: [
      "SAYFA 1 — TERMOREGÜLASYON: <32 hafta prematüre bebekler kurulanmadan boyundan aşağı polietilen torba/örtü içine alınmalı, doğumhane sıcaklığı 25–26°C tutulmalıdır.",
      "SAYFA 2 — SOLUNUM DESTEĞİ: Spontan solunumu olan prematürelerde entübasyon yerine T-parçalı resüsitatör ile 5–6 cmH2O CPAP tercih edilir; <28 hafta için başlangıç FiO2 %30 olarak ayarlanır.",
    ],
    readerStats: {},
  },
  {
    id: "mat_kawasaki_misc_2026",
    title: "Tam / İnkoplet Kawasaki Hastalığı ve Koroner Anevrizma İzlem Algoritması",
    category: "Çocuk Enfeksiyon",
    targetYears: [2, 3, 4],
    isMandatory: false,
    fileType: "slides",
    allowDownload: true,
    storagePath: "materials/cocuk_enfeksiyon/mat_kawasaki_misc_2026.pdf",
    uploadedBy: "Prof. Dr. Selim Kaya",
    description:
      "5 günden uzun süren ateşte tanı kriterleri, IVIG (2 g/kg) + ASA protokolü ve IVIG dirençli olgularda ikincil tedaviler.",
    createdAt: "2026-11-04",
    clinicalSummaryPages: [
      "SAYFA 1 — KLİNİK KRİTERLER: ≥5 gün ateş ile birlikte bilateral eksüdasız konjonktival enjeksiyon, oral mukoza değişiklikleri, polimorf döküntü, ekstremite değişiklikleri ve servikal LAP (≥1.5 cm) kriterlerinden en az 4'ü aranır.",
    ],
    readerStats: {},
  },
];

const FALLBACK_SESSION: ClinicMemberSession = {
  uid: "uid_user_1",
  email: "elif.demir@pediatri.edu.tr",
  fullName: "Dr. Elif Demir",
  title: "Asistan Dr.",
  residencyYear: 2,
  role: "user",
  status: "active",
  mfaVerified: true,
  mfaEnrolled: true,
  hasBoundDevice: true,
};

export default function TrainingMaterialsPage() {
  const { session: ctxSession } = useClinicSession();
  const session = ctxSession ?? FALLBACK_SESSION;
  const isAdmin = session.role === "admin";

  const [adminTab, setAdminTab] = useState<"browse" | "manage">("browse");
  const [materials, setMaterials] = useState<TrainingMaterialItem[]>(INITIAL_MATERIALS);
  const [selectedCategory, setSelectedCategory] = useState<string>("Tümü");
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const [activeViewerId, setActiveViewerId] = useState<string | null>(null);

  const activeMaterial = materials.find((m) => m.id === activeViewerId) || null;

  const filteredMaterials = materials.filter((m) => {
    const catMatch = selectedCategory === "Tümü" || m.category === selectedCategory;
    const yearMatch = selectedYear === 0 || m.targetYears.includes(selectedYear);
    return catMatch && yearMatch;
  });

  const handleMarkCompleted = (materialId: string, durationSeconds: number) => {
    setMaterials((prev) =>
      prev.map((m) =>
        m.id === materialId
          ? {
              ...m,
              readerStats: {
                ...m.readerStats,
                [session.uid]: {
                  fullName: `${session.title} ${session.fullName}`,
                  residencyYear: session.residencyYear,
                  durationSeconds,
                  completed: true,
                  lastViewedAt: new Date().toLocaleString("tr-TR"),
                },
              },
            }
          : m
      )
    );
    setActiveViewerId(null);
  };

  return (
    <section aria-labelledby="materials-page-heading">
      <div className="page-header">
        <div>
          <h1 id="materials-page-heading">Eğitim Materyalleri Paylaşma ve Görüntüleme</h1>
          <p className="page-header-subtitle">
            Bilim dalı ve asistan kıdem yılına göre filtreleme, sızıntı önleyici dinamik filigranlı belge görüntüleyici
            ve okunma takibi.
          </p>
        </div>

        {isAdmin && (
          <div className="mode-switcher" role="tablist" aria-label="Materyal Yönetim Sekmeleri">
            <button
              id="materials-tab-browse-btn"
              type="button"
              className={`mode-btn ${adminTab === "browse" ? "active" : ""}`}
              onClick={() => setAdminTab("browse")}
            >
              Materyal Kütüphanesi
            </button>
            <button
              id="materials-tab-manage-btn"
              type="button"
              className={`mode-btn ${adminTab === "manage" ? "active" : ""}`}
              onClick={() => setAdminTab("manage")}
            >
              Materyal Yükle &amp; Okunma Raporu
            </button>
          </div>
        )}
      </div>

      {isAdmin && adminTab === "manage" ? (
        <AdminMaterialManager
          materials={materials}
          onUploadMaterial={(newMat) => {
            setMaterials((prev) => [
              {
                ...newMat,
                id: `mat_${Date.now()}`,
                createdAt: new Date().toISOString().split("T")[0],
                readerStats: {},
              },
              ...prev,
            ]);
            setAdminTab("browse");
          }}
          onToggleAllowDownload={(id) =>
            setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, allowDownload: !m.allowDownload } : m)))
          }
        />
      ) : activeMaterial ? (
        <WatermarkedMaterialViewer
          material={activeMaterial}
          session={session}
          onMarkCompleted={handleMarkCompleted}
          onClose={() => setActiveViewerId(null)}
        />
      ) : (
        <>
          <div
            className="surface-card"
            style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}
          >
            <div>
              <label htmlFor="filter-category-select" className="form-label">
                Bilim Dalı Filtresi
              </label>
              <select
                id="filter-category-select"
                className="form-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="Tümü">Tüm Bilim Dalları</option>
                <option value="Çocuk Acil & Yoğun Bakım">Çocuk Acil &amp; Yoğun Bakım</option>
                <option value="Neonatoloji (Yenidoğan)">Neonatoloji (Yenidoğan)</option>
                <option value="Çocuk Enfeksiyon">Çocuk Enfeksiyon</option>
                <option value="Çocuk Nefroloji & Sıvı">Çocuk Nefroloji &amp; Sıvı</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-year-select" className="form-label">
                Asistan Kıdem Yılı
              </label>
              <select
                id="filter-year-select"
                className="form-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                <option value={0}>Tüm Kıdemler (1–4. Yıl)</option>
                <option value={1}>1. Yıl Asistanı</option>
                <option value={2}>2. Yıl Asistanı</option>
                <option value={3}>3. Yıl Asistanı</option>
                <option value={4}>4. Yıl Asistanı</option>
              </select>
            </div>
          </div>

          <div className="grid-3">
            {filteredMaterials.map((mat) => {
              const userStat = mat.readerStats[session.uid];
              return (
                <article
                  key={mat.id}
                  className="surface-card"
                  style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.4rem", flexWrap: "wrap" }}>
                      <span className="sec-chip info">{mat.category}</span>
                      {mat.isMandatory && <span className="sec-chip warning">Zorunlu</span>}
                    </div>
                    <h2 style={{ marginTop: "0.6rem", fontSize: "1.05rem" }}>{mat.title}</h2>
                    <p className="page-header-subtitle" style={{ fontSize: "0.84rem", marginTop: "0.35rem" }}>
                      {mat.description}
                    </p>
                  </div>

                  <div
                    style={{ marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid var(--border-subtle)" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.76rem",
                        marginBottom: "0.65rem",
                      }}
                    >
                      <span className="mono-num">Hedef: {mat.targetYears.join(", ")}. Yıl</span>
                      <span className={userStat?.completed ? "sec-chip success" : "sec-chip"}>
                        {userStat?.completed ? "Tamamlandı ✓" : "Henüz Okunmadı"}
                      </span>
                    </div>
                    <button
                      id={`open-material-viewer-btn-${mat.id}`}
                      type="button"
                      className="btn btn-primary"
                      style={{ width: "100%" }}
                      onClick={() => setActiveViewerId(mat.id)}
                    >
                      Filigranlı Görüntüleyicide Aç
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
