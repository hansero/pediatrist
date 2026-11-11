"use client";

import { useState } from "react";
import { MATERIAL_CATEGORIES, RESIDENCY_YEARS } from "@shared/constants";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import type { ClinicMemberSession } from "@/lib/auth/types";
import { FILE_TYPE_LABEL, yearsLabel, type MaterialView } from "@/lib/materials/admin";
import { filterMaterials, useMyProgress, usePublishedMaterials, type YearFilter } from "@/lib/materials/doctor";
import { MaterialViewer } from "./MaterialViewer";

/**
 * Hekim materyal listesi (F6.3). Varsayılan süzgeç hekimin kendi kıdemi (kıdemsiz uzman: tümü); kategori
 * ortak listeden. Her kartta kendi okuma durumu. Görüntüleyici aynı sayfada açılır.
 */
export function DoctorMaterials({ session }: { session: ClinicMemberSession }) {
  const materials = usePublishedMaterials();
  const [year, setYear] = useState<YearFilter>(session.residencyYear ?? "all");
  const [category, setCategory] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const list = filterMaterials(materials.data ?? [], { year, category });
  const open = (materials.data ?? []).find((m) => m.id === openId) ?? null;

  if (open) return <OpenMaterial material={open} session={session} onClose={() => setOpenId(null)} />;

  return (
    <div className="attendance-admin">
      <Card title="Süzgeç">
        <div className="report-filter">
          <Field label="Kıdem">
            {(p) => (
              <select
                {...p}
                className="form-select"
                value={String(year)}
                onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))}
              >
                <option value="all">Bütün kıdemler</option>
                {RESIDENCY_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}. yıl{y === session.residencyYear ? " (benim)" : ""}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Kategori">
            {(p) => (
              <select {...p} className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="all">Bütün kategoriler</option>
                {MATERIAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </Card>

      {materials.error && <Alert tone="critical">{materials.error}</Alert>}
      {materials.status === "loading" && <p className="page-header-subtitle">Materyaller yükleniyor…</p>}
      {materials.status === "ready" && list.length === 0 && (
        <Card title="Materyal">
          <EmptyState
            title="Bu süzgeçle materyal yok"
            description={year === "all" ? "Henüz yayında materyal yok." : "Kıdem süzgecini 'Bütün kıdemler' yapın."}
          />
        </Card>
      )}
      <ul className="material-grid" aria-label="Materyaller">
        {list.map((m) => (
          <li key={m.id}>
            <MaterialCard material={m} uid={session.uid} onOpen={() => setOpenId(m.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function MaterialCard({ material, uid, onOpen }: { material: MaterialView; uid: string; onOpen: () => void }) {
  const progress = useMyProgress(material.id, uid);
  const p = progress.data;
  return (
    <article className="material-card" aria-labelledby={`material-${material.id}`}>
      <div className="ui-actions">
        <StatusChip>{material.category}</StatusChip>
        {material.isMandatory && <StatusChip tone="info">Zorunlu</StatusChip>}
      </div>
      <h2 id={`material-${material.id}`} className="material-title">
        {material.title}
      </h2>
      {material.description && <p className="page-header-subtitle">{material.description}</p>}
      <p className="page-header-subtitle">
        {FILE_TYPE_LABEL[material.fileType]} · Hedef: {yearsLabel(material.targetYears)}
      </p>
      <div className="material-card-footer">
        <StatusChip tone={p?.completed ? "success" : p && p.secondsSpent > 0 ? "warning" : undefined}>
          {p?.completed ? "Tamamlandı" : p && p.secondsSpent > 0 ? "Okumaya başladınız" : "Okunmadı"}
        </StatusChip>
        <Button size="sm" onClick={onOpen} aria-label={`${material.title}: aç`}>
          Aç
        </Button>
      </div>
    </article>
  );
}

function OpenMaterial({
  material,
  session,
  onClose,
}: {
  material: MaterialView;
  session: ClinicMemberSession;
  onClose: () => void;
}) {
  const progress = useMyProgress(material.id, session.uid);
  if (progress.status === "loading") return <p className="page-header-subtitle">Materyal açılıyor…</p>;
  if (progress.status === "error") return <Alert tone="critical">{progress.error}</Alert>;
  // Kaydedilmiş ilerleme yalnızca açılışta okunur (kendi yazdıklarımız görüntüleyiciyi yeniden başlatmasın).
  return <MaterialViewer material={material} session={session} saved={progress.data} onClose={onClose} />;
}
