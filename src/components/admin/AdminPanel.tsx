"use client";

import { Tabs } from "@/components/ui/Tabs";
import { AuditLog } from "./audit/AuditLog";
import { Invitations } from "./invitations/Invitations";
import { MemberList } from "./members/MemberList";

/** Yönetim paneli (F7.1, F7.2): üyeler, davetler, denetim kayıtları. Bütün veri canlı; işlemler callable'larla. */
export function AdminPanel({ selfUid }: { selfUid: string }) {
  return (
    <Tabs
      label="Yönetim bölümleri"
      items={[
        { id: "members", label: "Üyeler", content: <MemberList selfUid={selfUid} /> },
        { id: "invitations", label: "Davetler", content: <Invitations /> },
        { id: "audit", label: "Denetim kayıtları", content: <AuditLog /> },
      ]}
    />
  );
}
