"use client";

import { useEffect, useState } from "react";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { AUDIT_RESOURCE_TYPES, AUDIT_SEVERITIES, type AuditResourceType, type AuditSeverity } from "@shared/constants";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { toUserMessage } from "@/lib/errors";
import { auditActionLabel, fetchAuditPage, type AuditRow } from "@/lib/admin/members";

const dateTime = new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "medium" });

const SEVERITY_LABEL: Record<AuditSeverity, string> = { INFO: "Bilgi", WARN: "Uyarı", CRITICAL: "Kritik" };
const MODULE_LABEL: Record<AuditResourceType, string> = {
  auth: "Kimlik",
  materials: "Materyal",
  calculators: "Hesaplayıcı",
  attendance: "Yoklama",
  quizzes: "Sınav",
  admin: "Yönetim",
};

function formatMetadata(m: Record<string, unknown>): string {
  return Object.entries(m)
    .map(([k, v]) => `${k}: ${typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

/**
 * Denetim kayıtları (F7.2): yalnızca sunucunun yazdığı kayıtlar (istemci kayıt üretmez); yeniden eskiye,
 * 50'şer sayfa; önem ve modül süzgeçleri. Kayıtlar değiştirilemez (kurallar istemci yazımını kapatır).
 */
export function AuditLog() {
  const [severity, setSeverity] = useState<AuditSeverity | "all">("all");
  const [module, setModule] = useState<AuditResourceType | "all">("all");
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);

  async function load(after: QueryDocumentSnapshot | null) {
    setStatus("loading");
    try {
      const page = await fetchAuditPage({ severity, resourceType: module }, after);
      setRows((prev) => (after ? [...prev, ...page.rows] : page.rows));
      setCursor(page.cursor);
      setStatus("ready");
    } catch (err) {
      setError(toUserMessage(err));
      setStatus("error");
    }
  }

  useEffect(() => {
    void load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severity, module, nonce]);

  return (
    <Card
      title="Denetim kayıtları"
      description="Sunucunun yazdığı, değiştirilemez kayıtlar (yeniden eskiye)."
      actions={
        <Button
          variant="secondary"
          onClick={() => setNonce((n) => n + 1)}
          loading={status === "loading"}
          loadingText="Yükleniyor…"
        >
          Yenile
        </Button>
      }
    >
      <div className="auth-stack">
        <div className="report-filter">
          <Field label="Önem">
            {(p) => (
              <select
                {...p}
                className="form-select"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as AuditSeverity | "all")}
              >
                <option value="all">Tümü</option>
                {AUDIT_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_LABEL[s]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Modül">
            {(p) => (
              <select
                {...p}
                className="form-select"
                value={module}
                onChange={(e) => setModule(e.target.value as AuditResourceType | "all")}
              >
                <option value="all">Tümü</option>
                {AUDIT_RESOURCE_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {MODULE_LABEL[m]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        {status === "error" && <Alert tone="critical">{error}</Alert>}
        <DataTable<AuditRow>
          caption="Denetim kayıtları"
          captionHidden
          columns={[
            { key: "time", header: "Zaman", cell: (r) => (r.timestampMs ? dateTime.format(r.timestampMs) : "—") },
            {
              key: "action",
              header: "Eylem",
              rowHeader: true,
              cell: (r) => (
                <>
                  {auditActionLabel(r.action)}
                  <span className="page-header-subtitle mono-num"> {r.action}</span>
                </>
              ),
            },
            {
              key: "severity",
              header: "Önem",
              cell: (r) => (
                <StatusChip
                  tone={r.severity === "CRITICAL" ? "critical" : r.severity === "WARN" ? "warning" : undefined}
                >
                  {SEVERITY_LABEL[r.severity]}
                </StatusChip>
              ),
            },
            { key: "actor", header: "Yapan", cell: (r) => <span className="break-all">{r.actorEmail}</span> },
            {
              key: "resource",
              header: "Kaynak",
              cell: (r) => (
                <span className="break-all">
                  {MODULE_LABEL[r.resourceType as AuditResourceType] ?? r.resourceType} · {r.resourceId}
                </span>
              ),
            },
            {
              key: "meta",
              header: "Ayrıntı",
              cell: (r) =>
                Object.keys(r.metadata).length ? (
                  <details>
                    <summary>Göster</summary>
                    <span className="break-all">{formatMetadata(r.metadata)}</span>
                  </details>
                ) : (
                  "—"
                ),
            },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          loading={status === "loading" && rows.length === 0}
          error={status === "error" && rows.length === 0 ? error : undefined}
          empty={<EmptyState title="Bu süzgeçle kayıt yok" />}
        />
        {cursor && (
          <div className="ui-actions">
            <Button
              variant="secondary"
              onClick={() => void load(cursor)}
              loading={status === "loading"}
              loadingText="Yükleniyor…"
            >
              Daha fazla yükle
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
