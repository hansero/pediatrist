"use client";

import React, { useState } from "react";
import { RESIDENCY_YEARS, type ResidencyYear, type Role } from "@shared/constants";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { INVITATION_STATE_LABEL, ROLE_LABEL, useInvitations, type InvitationRow } from "@/lib/admin/members";
import { createInvitation, revokeInvitation } from "@/lib/firebase/callables";

const dateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" });

/**
 * Davetler (F7.1): davet kodu sunucuda üretilir; davetle kayıt olan üye onay beklemeden etkinleşir (F2.3).
 * Kod ekranda gösterilir ve kopyalanabilir; e-posta gönderimi yoktur (admin kodu kurum içi kanaldan iletir).
 */
export function Invitations() {
  const toast = useToast();
  const invitations = useInvitations();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [year, setYear] = useState<ResidencyYear | "">("");
  const [days, setDays] = useState("14");
  const [created, setCreated] = useState<{ email: string; code: string } | null>(null);
  const [revoking, setRevoking] = useState<InvitationRow | null>(null);
  const create = useAsyncAction(createInvitation);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await create.run({
      email,
      intendedRole: role,
      ...(role === "user" && year !== "" ? { residencyYear: year } : {}),
      validForDays: Number(days),
    });
    if (res) {
      setCreated({ email: email.trim().toLowerCase(), code: res.code });
      setEmail("");
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.show("Davet kodu kopyalandı.", { tone: "success" });
    } catch {
      toast.show("Pano erişimi yok; kodu elle seçip kopyalayın.", { tone: "warning" });
    }
  }

  return (
    <div className="attendance-admin">
      <Card
        title="Davet oluştur"
        description="Davet kodu ile kayıt olan üye onay beklemeden etkinleşir. Kodu kurum içi kanaldan iletin."
      >
        <form className="auth-stack" onSubmit={onSubmit} noValidate>
          {create.error && <Alert tone="critical">{create.error}</Alert>}
          {created && (
            <Alert tone="success" title={`${created.email} için davet kodu`}>
              <span className="ui-actions">
                <code className="invite-code">{created.code}</code>
                <Button size="sm" variant="secondary" onClick={() => void copy(created.code)}>
                  Kodu kopyala
                </Button>
              </span>
            </Alert>
          )}
          <Field label="E-posta" required>
            {(p) => (
              <input
                {...p}
                type="email"
                className="form-input"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          <div className="grid-2">
            <Field label="Rol">
              {(p) => (
                <select {...p} className="form-select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="user">{ROLE_LABEL.user}</option>
                  <option value="admin">{ROLE_LABEL.admin}</option>
                </select>
              )}
            </Field>
            {role === "user" && (
              <Field label="Kıdem" hint="Boş bırakılırsa kayıt olan seçer.">
                {(p) => (
                  <select
                    {...p}
                    className="form-select"
                    value={String(year)}
                    onChange={(e) => setYear(e.target.value === "" ? "" : (Number(e.target.value) as ResidencyYear))}
                  >
                    <option value="">Kayıtta seçilsin</option>
                    {RESIDENCY_YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}. yıl
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}
          </div>
          <Field label="Geçerlilik (gün)" hint="1–90 gün.">
            {(p) => (
              <input
                {...p}
                type="number"
                inputMode="numeric"
                min={1}
                max={90}
                className="form-input"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            )}
          </Field>
          <div className="ui-actions">
            <Button type="submit" loading={create.pending} loadingText="Oluşturuluyor…">
              Davet oluştur
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Davetler" description="Son 200 davet.">
        <DataTable<InvitationRow>
          caption="Davet listesi"
          captionHidden
          columns={[
            {
              key: "email",
              header: "E-posta",
              rowHeader: true,
              cell: (i) => <span className="break-all">{i.email}</span>,
            },
            {
              key: "role",
              header: "Rol",
              cell: (i) => `${ROLE_LABEL[i.intendedRole]}${i.residencyYear ? ` · ${i.residencyYear}. yıl` : ""}`,
            },
            { key: "code", header: "Kod", cell: (i) => <code>{i.code}</code> },
            {
              key: "state",
              header: "Durum",
              cell: (i) => (
                <StatusChip tone={i.state === "valid" ? "success" : i.state === "used" ? "info" : undefined}>
                  {INVITATION_STATE_LABEL[i.state]}
                </StatusChip>
              ),
            },
            {
              key: "expires",
              header: "Son gün",
              cell: (i) => (i.expiresAtMs ? dateFormat.format(i.expiresAtMs) : "—"),
            },
            {
              key: "action",
              header: <span className="sr-only">İşlem</span>,
              align: "end",
              cell: (i) =>
                i.state === "valid" ? (
                  <Button size="sm" variant="ghost" onClick={() => setRevoking(i)}>
                    İptal et<span className="sr-only">: {i.email} daveti</span>
                  </Button>
                ) : null,
            },
          ]}
          rows={invitations.data ?? []}
          rowKey={(i) => i.id}
          loading={invitations.status === "loading"}
          error={invitations.error}
          empty={<EmptyState title="Henüz davet yok" />}
        />
      </Card>

      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title="Daveti iptal et"
        description={`${revoking?.email ?? ""} için kod (${revoking?.code ?? ""}) artık kayıtta kullanılamaz.`}
        confirmLabel="Daveti iptal et"
        pendingLabel="İptal ediliyor…"
        tone="danger"
        onConfirm={async () => {
          if (!revoking) return;
          await revokeInvitation({ invitationId: revoking.id });
          toast.show("Davet iptal edildi.", { tone: "success" });
        }}
      />
    </div>
  );
}
