"use client";

import React, { useEffect, useRef, useState } from "react";
import type { ResidencyYear } from "@shared/constants";
import { audienceLabel, distinctLabels, type LabelOption } from "@shared/materials";
import { Alert } from "@/components/ui/Alert";
import { ListLimitNotice } from "@/components/ui/ListLimitNotice";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { deleteMaterial, updateMaterial } from "@/lib/firebase/callables";
import {
  EMPTY_ADMIN_MATERIAL_FILTER,
  FILE_TYPE_LABEL,
  filterAdminMaterials,
  formatBytes,
  useMaterials,
  type AdminMaterialFilter,
  type MaterialView,
} from "@/lib/materials/admin";
import { AUDIENCE_OPTIONS, parseYearFilter } from "@/lib/materials/doctor";
import {
  MaterialFields,
  validateMaterialFields,
  type MaterialFieldErrors,
  type MaterialFieldsValue,
} from "./MaterialFields";
import { MaterialReadReport } from "./MaterialReadReport";

const dateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" });

/** Materyaller (F6.2): canlı liste; düzenle, sil (onaylı), okunma raporu. Taslak = yükleme yarım kaldı. */
export function MaterialList({ onUpload }: { onUpload: () => void }) {
  const toast = useToast();
  const materials = useMaterials();
  const [editing, setEditing] = useState<MaterialView | null>(null);
  const [deleting, setDeleting] = useState<MaterialView | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const all = materials.data ?? [];
  const [filter, setFilter] = useState<AdminMaterialFilter>(EMPTY_ADMIN_MATERIAL_FILTER);
  const labels = distinctLabels(all);
  const rows = filterAdminMaterials(all, filter);
  const filtered = filter.search.trim() !== "" || filter.label !== "all" || filter.target !== "all";
  const reportFor = all.find((m) => m.id === reportId) ?? null;

  useEffect(() => {
    if (reportId) reportRef.current?.focus();
  }, [reportId]);

  const columns: Column<MaterialView>[] = [
    {
      key: "title",
      header: "Materyal",
      rowHeader: true,
      cell: (m) => (
        <>
          {m.title}
          {m.isMandatory && (
            <>
              {" "}
              <StatusChip tone="info">Zorunlu</StatusChip>
            </>
          )}
        </>
      ),
    },
    { key: "labels", header: "Etiketler", cell: (m) => (m.labels.length ? m.labels.join(", ") : "—") },
    { key: "years", header: "Hedef kıdem", cell: (m) => audienceLabel(m) },
    {
      key: "file",
      header: "Dosya",
      cell: (m) => (
        <span className="nowrap">
          {FILE_TYPE_LABEL[m.fileType]} · {formatBytes(m.sizeBytes)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Durum",
      cell: (m) =>
        m.status === "published" ? (
          <StatusChip tone="success">Yayında</StatusChip>
        ) : (
          <StatusChip tone="warning">Yükleme tamamlanmadı</StatusChip>
        ),
    },
    { key: "date", header: "Eklenme", cell: (m) => (m.createdAtMs ? dateFormat.format(m.createdAtMs) : "—") },
    {
      key: "actions",
      header: <span className="sr-only">İşlemler</span>,
      align: "end",
      cell: (m) => (
        <span className="ui-actions table-actions">
          {m.status === "published" && (
            <Button size="sm" onClick={() => setReportId(m.id)} aria-label={`${m.title}: okunma raporu`}>
              Okunma
            </Button>
          )}
          {m.status === "published" && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(m)} aria-label={`${m.title}: düzenle`}>
              Düzenle
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setDeleting(m)} aria-label={`${m.title}: sil`}>
            Sil
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="attendance-admin">
      <Card
        title="Materyaller"
        description="Hekimler yalnızca yayındaki ve kendi kıdemlerine yönelik materyalleri varsayılan olarak görür."
        actions={<Button onClick={onUpload}>Materyal yükle</Button>}
      >
        {materials.error && <Alert tone="critical">{materials.error}</Alert>}
        <div className="report-filter" role="search" aria-label="Materyal süzgeci">
          <Field label="Ara" hint="Başlık, açıklama, dosya adı veya etiket.">
            {(p) => (
              <input
                {...p}
                type="search"
                className="form-input"
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              />
            )}
          </Field>
          <Field label="Etiket">
            {(p) => (
              <select
                {...p}
                className="form-select"
                value={filter.label}
                onChange={(e) => setFilter({ ...filter, label: e.target.value })}
              >
                <option value="all">Bütün etiketler</option>
                {labels.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.label} ({l.count})
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Hedef kıdem">
            {(p) => (
              <select
                {...p}
                className="form-select"
                value={String(filter.target)}
                onChange={(e) => setFilter({ ...filter, target: parseYearFilter(e.target.value) })}
              >
                <option value="all">Bütün kıdemler</option>
                {AUDIENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        {materials.status === "ready" && all.length > 0 && (
          <div className="ui-actions">
            <p className="page-header-subtitle" aria-live="polite" data-testid="material-filter-count">
              {filtered ? `${rows.length} / ${all.length} materyal gösteriliyor` : `${all.length} materyal`}
            </p>
            {filtered && (
              <Button variant="secondary" size="sm" onClick={() => setFilter(EMPTY_ADMIN_MATERIAL_FILTER)}>
                Süzgeci temizle
              </Button>
            )}
          </div>
        )}
        <ListLimitNotice
          truncated={materials.truncated}
          cap={materials.cap}
          what="en yeni materyal"
          hint="Eskileri görmek için kullanılmayan materyalleri silin."
        />
        <DataTable
          caption="Materyal listesi"
          captionHidden
          columns={columns}
          rows={rows}
          rowKey={(m) => m.id}
          loading={materials.status === "loading"}
          error={materials.error}
          empty={
            all.length > 0 ? (
              <EmptyState title="Bu süzgeçle materyal yok" description="Süzgeci değiştirin ya da temizleyin." />
            ) : (
              <EmptyState title="Henüz materyal yok" description="PDF, video veya görsel yükleyin." />
            )
          }
        />
      </Card>

      {reportFor && (
        <div ref={reportRef} tabIndex={-1} className="report-detail">
          <MaterialReadReport material={reportFor} onClose={() => setReportId(null)} />
        </div>
      )}

      <EditMaterialDialog material={editing} labelSuggestions={labels} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Materyali sil"
        description={`"${deleting?.title ?? ""}" dosyası ve bütün hekimlerin okuma kayıtları kalıcı olarak silinir. Bu işlem geri alınamaz.`}
        confirmLabel="Materyali sil"
        pendingLabel="Siliniyor…"
        tone="danger"
        onConfirm={async () => {
          if (!deleting) return;
          const res = await deleteMaterial({ materialId: deleting.id });
          if (reportId === deleting.id) setReportId(null);
          toast.show(
            res.progressDeleted
              ? `Materyal silindi (${res.progressDeleted} okuma kaydıyla birlikte).`
              : "Materyal silindi.",
            { tone: "success" }
          );
        }}
      />
    </div>
  );
}

function EditMaterialDialog({
  material,
  labelSuggestions,
  onClose,
}: {
  material: MaterialView | null;
  labelSuggestions: readonly LabelOption[];
  onClose: () => void;
}) {
  const toast = useToast();
  const [value, setValue] = useState<MaterialFieldsValue | null>(null);
  const [errors, setErrors] = useState<MaterialFieldErrors>({});
  const save = useAsyncAction(updateMaterial);
  const id = material?.id;

  useEffect(() => {
    setValue(
      material
        ? {
            title: material.title,
            description: material.description,
            labels: material.labels,
            // Veritabanındaki kıdemler sunucuda ortak listeyle doğrulanmıştır.
            targetYears: material.targetYears as ResidencyYear[],
            targetSpecialists: material.targetSpecialists,
            isMandatory: material.isMandatory,
            allowDownload: material.allowDownload,
          }
        : null
    );
    setErrors({});
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function close() {
    if (save.pending) return;
    onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!material || !value) return;
    const found = validateMaterialFields(value);
    setErrors(found);
    if (Object.keys(found).length) return;
    const res = await save.run({
      materialId: material.id,
      ...value,
    });
    if (res) {
      toast.show("Materyal güncellendi.", { tone: "success" });
      onClose();
    }
  }

  return (
    <Dialog
      open={material !== null}
      onClose={close}
      title="Materyali düzenle"
      description={material?.title}
      dismissible={!save.pending}
    >
      {value && (
        <form className="auth-stack" onSubmit={onSubmit} noValidate>
          {save.error && <Alert tone="critical">{save.error}</Alert>}
          <MaterialFields
            idPrefix="edit-material"
            value={value}
            onChange={setValue}
            errors={errors}
            labelSuggestions={labelSuggestions}
          />
          <p className="page-header-subtitle">Dosyayı değiştirmek için materyali silip yeniden yükleyin.</p>
          <div className="ui-dialog-actions">
            <Button variant="secondary" onClick={close} disabled={save.pending}>
              Vazgeç
            </Button>
            <Button type="submit" loading={save.pending} loadingText="Kaydediliyor…">
              Kaydet
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
