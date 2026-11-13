"use client";

import { audienceLabel } from "@shared/materials";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { useActiveDoctors } from "@/lib/attendance/live";
import { downloadCsv } from "@/lib/csv";
import {
  buildReadReport,
  READ_STATUS_LABEL,
  readReportCsv,
  useMaterialProgress,
  type MaterialView,
  type ReadRow,
} from "@/lib/materials/admin";

const dateTime = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });

/**
 * Okunma raporu (F6.2): hedef kitle = materyalin hedef kıdemlerindeki etkin asistanlar; ilerleme canlı.
 * Hedef dışından okuyanlar da listelenir ama sayılara katılmaz.
 */
export function MaterialReadReport({ material, onClose }: { material: MaterialView; onClose: () => void }) {
  const progress = useMaterialProgress(material.id);
  const doctors = useActiveDoctors();
  const ready = progress.status === "ready" && doctors.status === "ready";
  const report = ready ? buildReadReport(material, doctors.data, progress.data) : null;

  return (
    <Card
      title={`${material.title}: okunma raporu`}
      description={`Hedef kitle: ${audienceLabel(material)} (etkin üyeler).`}
      actions={
        <span className="ui-actions">
          <Button
            variant="secondary"
            disabled={!report || report.rows.length === 0}
            onClick={() => {
              if (!report) return;
              const csv = readReportCsv(material.title, report.rows);
              downloadCsv(csv.fileName, csv.headers, csv.rows);
            }}
            aria-label="Okunma raporunu CSV olarak indir"
          >
            CSV indir
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Kapat
          </Button>
        </span>
      }
    >
      <div className="auth-stack">
        {(progress.error || doctors.error) && <Alert tone="critical">{progress.error || doctors.error}</Alert>}
        {report && (
          <dl className="lecture-stats" aria-label="Okunma özeti">
            <div>
              <dt>Hedef kitle</dt>
              <dd className="mono-num">{report.targeted}</dd>
            </div>
            <div>
              <dt>Tamamladı</dt>
              <dd className="mono-num">{report.completed}</dd>
            </div>
            <div>
              <dt>Başladı</dt>
              <dd className="mono-num">{report.started}</dd>
            </div>
            <div>
              <dt>Başlamadı</dt>
              <dd className="mono-num">{report.notStarted}</dd>
            </div>
          </dl>
        )}
        <DataTable<ReadRow>
          caption={`${material.title}: okunma durumu`}
          captionHidden
          columns={[
            {
              key: "name",
              header: "Hekim",
              rowHeader: true,
              cell: (r) => (
                <>
                  {r.name}
                  {!r.targeted && <span className="page-header-subtitle"> (hedef dışı)</span>}
                </>
              ),
            },
            { key: "year", header: "Kıdem", cell: (r) => r.audience },
            {
              key: "status",
              header: "Durum",
              cell: (r) => (
                <StatusChip
                  tone={r.status === "completed" ? "success" : r.status === "started" ? "warning" : undefined}
                >
                  {READ_STATUS_LABEL[r.status]}
                </StatusChip>
              ),
            },
            {
              key: "time",
              header: "Süre",
              align: "end",
              cell: (r) => <span className="mono-num">{Math.round(r.secondsSpent / 60)} dk</span>,
            },
            { key: "page", header: "Son sayfa", align: "end", cell: (r) => (r.lastPage ? r.lastPage : "—") },
            { key: "date", header: "Son okuma", cell: (r) => (r.updatedAtMs ? dateTime.format(r.updatedAtMs) : "—") },
          ]}
          rows={report?.rows ?? []}
          rowKey={(r) => r.uid}
          loading={!ready && !progress.error && !doctors.error}
          empty={<EmptyState title="Hedef kıdemde etkin asistan yok" />}
        />
      </div>
    </Card>
  );
}
