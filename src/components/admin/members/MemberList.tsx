"use client";

import React, { useRef, useState } from "react";
import { RESIDENCY_YEARS, type MemberStatus, type ResidencyYear } from "@shared/constants";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { ListLimitNotice } from "@/components/ui/ListLimitNotice";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import {
  availableActions,
  filterMembers,
  memberName,
  ROLE_LABEL,
  STATUS_LABEL,
  useMembers,
  type MemberAction,
  type MemberRow,
} from "@/lib/admin/members";
import { deleteMember, resetMemberMfa, updateMemberAccess } from "@/lib/firebase/callables";
import { downloadMemberExport } from "@/lib/privacy";

interface ActionSpec {
  label: string;
  /** Kimi ve sonucu açıkça söyler. */
  describe: (name: string) => string;
  confirmLabel: string;
  tone: "danger" | "primary";
  run: (m: MemberRow) => Promise<unknown>;
  done: (name: string) => string;
}

/** Adı yazarak onaylanan (yetki veren ya da geri alınamayan) işlemler. */
type TypedAction = "makeAdmin" | "delete";

const ACTIONS: Record<Exclude<MemberAction, TypedAction | "changeYear">, ActionSpec> = {
  exportData: {
    label: "Veri dökümünü indir",
    describe: (n) =>
      `${n} hakkında platformda tutulan kişisel veriler (profil, sınav, yoklama ve materyal kayıtları) bir dosya olarak indirilir. İşlem denetim kaydına geçer; dosyayı yalnızca ilgili kişiye iletin.`,
    confirmLabel: "Dökümü indir",
    tone: "primary",
    run: (m) => downloadMemberExport(m.uid),
    done: (n) => `${n}: veri dökümü indirildi.`,
  },
  approve: {
    label: "Üyeliği onayla",
    describe: (n) => `${n} platforma giriş yapabilir ve kendi kıdemine yönelik içeriği görür.`,
    confirmLabel: "Onayla",
    tone: "primary",
    run: (m) => updateMemberAccess({ targetUid: m.uid, status: "active" }),
    done: (n) => `${n} onaylandı.`,
  },
  reactivate: {
    label: "Yeniden etkinleştir",
    describe: (n) => `${n} askıdan alınır ve yeniden giriş yapabilir.`,
    confirmLabel: "Yeniden etkinleştir",
    tone: "primary",
    run: (m) => updateMemberAccess({ targetUid: m.uid, status: "active" }),
    done: (n) => `${n} yeniden etkinleştirildi.`,
  },
  suspend: {
    label: "Askıya al",
    describe: (n) => `${n} adlı üyenin açık oturumları hemen kapatılır ve giriş yapamaz. Kayıtları silinmez.`,
    confirmLabel: "Askıya al",
    tone: "danger",
    run: (m) => updateMemberAccess({ targetUid: m.uid, status: "suspended" }),
    done: (n) => `${n} askıya alındı.`,
  },
  removeAdmin: {
    label: "Eğitim sorumlusu yetkisini kaldır",
    describe: (n) => `${n} hekim rolüne döner; yönetim ekranlarına erişemez ve oturumları kapatılır.`,
    confirmLabel: "Yetkiyi kaldır",
    tone: "danger",
    run: (m) => updateMemberAccess({ targetUid: m.uid, role: "user" }),
    done: (n) => `${n} artık hekim rolünde.`,
  },
  resetDevice: {
    label: "Yoklama cihazını sıfırla",
    describe: (n) =>
      `${n} adlı üyenin kayıtlı telefonu (passkey) silinir ve oturumları kapatılır. Yoklama için yeni telefonunu kaydetmesi gerekir.`,
    confirmLabel: "Cihazı sıfırla",
    tone: "danger",
    run: (m) => updateMemberAccess({ targetUid: m.uid, resetBoundDevice: true }),
    done: (n) => `${n} adlı üyenin yoklama cihazı sıfırlandı.`,
  },
  resetMfa: {
    label: "İki aşamalı doğrulamayı sıfırla",
    describe: (n) =>
      `${n} adlı üyenin Authenticator kaydı silinir ve oturumları kapatılır. Yeniden giriş yapıp kurulumu tekrarlaması gerekir. Yalnızca kimliğini doğruladığınız ve telefonunu kaybeden üyede kullanın.`,
    confirmLabel: "Doğrulamayı sıfırla",
    tone: "danger",
    run: (m) => resetMemberMfa({ targetUid: m.uid }),
    done: (n) => `${n} adlı üyenin iki aşamalı doğrulaması sıfırlandı.`,
  },
};

const STATUS_FILTERS: { id: MemberStatus | "all"; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "pending", label: "Onay bekleyen" },
  { id: "active", label: "Etkin" },
  { id: "suspended", label: "Askıda" },
];

/**
 * Üyeler (F7.1): canlı liste, arama ve durum süzgeci (bekleyenler üstte). Her işlem kişiyi ve sonucu açıkça
 * söyleyen bir onay ister; eğitim sorumlusu yapmak adı yazarak onaylanır. Sonuç yalnızca sunucu yanıtından sonra.
 */
export function MemberList({ selfUid }: { selfUid: string }) {
  const toast = useToast();
  const members = useMembers();
  const [status, setStatus] = useState<MemberStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [menuFor, setMenuFor] = useState<MemberRow | null>(null);
  const [confirm, setConfirm] = useState<{ member: MemberRow; action: keyof typeof ACTIONS } | null>(null);
  const [typed, setTyped] = useState<{ member: MemberRow; action: TypedAction } | null>(null);
  const [yearFor, setYearFor] = useState<MemberRow | null>(null);

  const all = members.data ?? [];
  const rows = filterMembers(all, { status, search });
  const pendingCount = all.filter((m) => m.status === "pending").length;

  function choose(member: MemberRow, action: MemberAction) {
    setMenuFor(null);
    if (action === "makeAdmin" || action === "delete") setTyped({ member, action });
    else if (action === "changeYear") setYearFor(member);
    else setConfirm({ member, action });
  }

  const columns: Column<MemberRow>[] = [
    {
      key: "name",
      header: "Üye",
      rowHeader: true,
      cell: (m) => (
        <>
          {memberName(m)}
          {m.uid === selfUid && <span className="page-header-subtitle"> (siz)</span>}
        </>
      ),
    },
    { key: "email", header: "E-posta", cell: (m) => <span className="break-all">{m.email}</span> },
    { key: "role", header: "Rol", cell: (m) => ROLE_LABEL[m.role] },
    { key: "year", header: "Kıdem", cell: (m) => (m.residencyYear ? `${m.residencyYear}. yıl` : "—") },
    {
      key: "status",
      header: "Durum",
      cell: (m) => (
        <StatusChip tone={m.status === "active" ? "success" : m.status === "pending" ? "warning" : "critical"}>
          {STATUS_LABEL[m.status]}
        </StatusChip>
      ),
    },
    { key: "device", header: "Yoklama cihazı", cell: (m) => (m.hasDevice ? "Kayıtlı" : "—") },
    {
      key: "actions",
      header: <span className="sr-only">İşlemler</span>,
      align: "end",
      cell: (m) =>
        availableActions(m, selfUid).length ? (
          // Görünen metin erişilebilir adın başında (WCAG 2.5.3); kişi görünmez metinle eklenir (F8.1).
          <Button size="sm" variant="secondary" onClick={() => setMenuFor(m)}>
            İşlemler<span className="sr-only"> ({memberName(m)})</span>
          </Button>
        ) : null,
    },
  ];

  const spec = confirm ? ACTIONS[confirm.action] : null;

  return (
    <Card title="Üyeler" description={pendingCount ? `${pendingCount} üye onay bekliyor.` : "Onay bekleyen üye yok."}>
      <div className="auth-stack">
        <div className="report-filter">
          <Field label="Ara" hint="Ad veya e-posta.">
            {(p) => (
              <input
                {...p}
                type="search"
                className="form-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
          </Field>
        </div>
        <div role="group" aria-label="Duruma göre süz" className="mode-switcher">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`mode-btn${status === f.id ? " active" : ""}`}
              aria-pressed={status === f.id}
              onClick={() => setStatus(f.id)}
            >
              {f.label}
              {f.id !== "all" && ` (${all.filter((m) => m.status === f.id).length})`}
            </button>
          ))}
        </div>
        <ListLimitNotice
          truncated={members.truncated}
          cap={members.cap}
          what="üye"
          hint="Aradığınız üye listede yoksa platform yöneticisine bildirin."
        />
        <DataTable
          caption="Üye listesi"
          captionHidden
          columns={columns}
          rows={rows}
          rowKey={(m) => m.uid}
          loading={members.status === "loading"}
          error={members.error}
          empty={<EmptyState title="Bu süzgeçle üye yok" />}
        />
      </div>

      <Dialog
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title="Üye işlemleri"
        description={menuFor ? `${memberName(menuFor)} · ${menuFor.email}` : undefined}
      >
        <div className="action-list">
          {menuFor &&
            availableActions(menuFor, selfUid).map((a) => (
              <Button
                key={a}
                variant={a === "approve" || a === "reactivate" ? "primary" : "secondary"}
                onClick={() => choose(menuFor, a)}
              >
                {a === "makeAdmin" || a === "delete"
                  ? TYPED_ACTIONS[a].title
                  : a === "changeYear"
                    ? "Kıdemi değiştir"
                    : ACTIONS[a].label}
              </Button>
            ))}
          {menuFor?.uid === selfUid && (
            <p className="page-header-subtitle">
              Kendi rolünüzü, durumunuzu veya iki aşamalı doğrulamanızı buradan değiştiremez, hesabınızı silemezsiniz.
            </p>
          )}
        </div>
        <div className="ui-dialog-actions">
          <Button variant="secondary" onClick={() => setMenuFor(null)}>
            Kapat
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={spec?.label ?? ""}
        description={confirm && spec ? spec.describe(memberName(confirm.member)) : ""}
        confirmLabel={spec?.confirmLabel ?? "Onayla"}
        pendingLabel="İşleniyor…"
        tone={spec?.tone}
        onConfirm={async () => {
          if (!confirm || !spec) return;
          await spec.run(confirm.member);
          toast.show(spec.done(memberName(confirm.member)), { tone: "success" });
        }}
      />
      <TypedNameDialog
        key={typed ? `${typed.action}:${typed.member.uid}` : "kapali"}
        target={typed}
        onClose={() => setTyped(null)}
      />
      {/* Anahtar: başlangıç kıdemi ilk çizimde hazır (efektle doldurmak o arada yapılan seçimi ezebiliyordu). */}
      <YearDialog key={yearFor?.uid ?? "kapali"} member={yearFor} onClose={() => setYearFor(null)} />
    </Card>
  );
}

const norm = (v: string) => v.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr");

interface TypedSpec {
  title: string;
  warning: (name: string) => string;
  confirmLabel: string;
  run: (m: MemberRow) => Promise<unknown>;
  done: (name: string) => string;
}

const TYPED_ACTIONS: Record<TypedAction, TypedSpec> = {
  makeAdmin: {
    title: "Eğitim sorumlusu yap",
    warning: (n) => `${n} bütün üyeleri yönetebilir, sınav ve materyal yayınlayabilir, denetim kayıtlarını görebilir.`,
    confirmLabel: "Eğitim sorumlusu yap",
    run: (m) => updateMemberAccess({ targetUid: m.uid, role: "admin" }),
    done: (n) => `${n} eğitim sorumlusu oldu.`,
  },
  delete: {
    title: "Üyeyi sil",
    warning: (n) =>
      `${n} adlı üyenin giriş hesabı ve profili kalıcı olarak silinir; bu işlem geri alınamaz. Sınav ve yoklama kayıtları istatistik için kalır, ancak adı, mazeret notları ve okuma kayıtları silinir. Gerekiyorsa önce veri dökümünü indirin.`,
    confirmLabel: "Üyeyi sil",
    run: (m) => deleteMember({ targetUid: m.uid }),
    done: (n) => `${n} silindi; kayıtları addan arındırıldı.`,
  },
};

/**
 * Adı yazarak onay: yetki veren (eğitim sorumlusu yapma) ve geri alınamayan (üye silme, F9.1) işlemler.
 * Onay düğmesi ad tam yazılana kadar kapalıdır; sonuç yalnızca sunucu yanıtından sonra bildirilir.
 */
function TypedNameDialog({
  target,
  onClose,
}: {
  target: { member: MemberRow; action: TypedAction } | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [typed, setTyped] = useState("");
  const spec = target ? TYPED_ACTIONS[target.action] : null;
  const run = useAsyncAction(async (m: MemberRow) => {
    await spec?.run(m);
    return true as const;
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const name = target ? memberName(target.member) : "";
  const matches = target !== null && norm(typed) === norm(name);

  function close() {
    if (run.pending) return;
    onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target || !spec || !matches) return;
    if (await run.run(target.member)) {
      toast.show(spec.done(name), { tone: "success" });
      onClose();
    }
  }

  return (
    <Dialog
      open={target !== null}
      onClose={close}
      title={spec?.title ?? ""}
      role="alertdialog"
      initialFocusRef={inputRef}
      dismissible={!run.pending}
    >
      <form className="auth-stack" onSubmit={onSubmit} noValidate>
        {run.error && <Alert tone="critical">{run.error}</Alert>}
        <Alert tone="warning">{spec?.warning(name)}</Alert>
        <Field label={`Onaylamak için "${name}" yazın`}>
          {(p) => (
            <input
              {...p}
              ref={inputRef}
              className="form-input"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          )}
        </Field>
        <div className="ui-dialog-actions">
          <Button variant="secondary" onClick={close} disabled={run.pending}>
            Vazgeç
          </Button>
          <Button type="submit" variant="danger" disabled={!matches} loading={run.pending} loadingText="İşleniyor…">
            {spec?.confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function YearDialog({ member, onClose }: { member: MemberRow | null; onClose: () => void }) {
  const toast = useToast();
  const [year, setYear] = useState<ResidencyYear>(() => (member?.residencyYear ?? 1) as ResidencyYear);
  const run = useAsyncAction(updateMemberAccess);

  function close() {
    if (run.pending) return;
    onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    if (await run.run({ targetUid: member.uid, residencyYear: year })) {
      toast.show(`${memberName(member)}: kıdem ${year}. yıl olarak kaydedildi.`, { tone: "success" });
      close();
    }
  }

  return (
    <Dialog
      open={member !== null}
      onClose={close}
      title="Kıdemi değiştir"
      description={member ? memberName(member) : undefined}
      dismissible={!run.pending}
    >
      <form className="auth-stack" onSubmit={onSubmit} noValidate>
        {run.error && <Alert tone="critical">{run.error}</Alert>}
        <Field label="Kıdem yılı" hint="Materyal hedeflemesi ve raporlar bu değeri kullanır.">
          {(p) => (
            <select
              {...p}
              className="form-select"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) as ResidencyYear)}
            >
              {RESIDENCY_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}. yıl
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="ui-dialog-actions">
          <Button variant="secondary" onClick={close} disabled={run.pending}>
            Vazgeç
          </Button>
          <Button type="submit" loading={run.pending} loadingText="Kaydediliyor…">
            Kaydet
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
