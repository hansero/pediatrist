"use client";

import type { CallableResponse } from "@shared/schemas";
import { downloadTextFile } from "@/lib/csv";
import { exportMemberData } from "@/lib/firebase/callables";
import { slugify } from "@/lib/slug";

export type MemberExport = CallableResponse<"exportMemberData">;

/** Döküm dosyasının adı: kişi ve tarih (ör. `pediatrist-veri-dokumu-selin-ates-2026-11-11.json`). */
export function exportFileName(data: Pick<MemberExport, "exportedAt" | "profile">): string {
  const who = slugify(data.profile.fullName) || "uye";
  return `pediatrist-veri-dokumu-${who}-${data.exportedAt.slice(0, 10)}.json`;
}

/**
 * Kişisel veri dökümünü (KVKK md. 11, F9.1) sunucudan alır ve JSON dosyası olarak indirir. Üye kendi verisini,
 * eğitim sorumlusu her üyenin verisini alabilir (yetki sunucuda). Dosya okunabilir biçimdedir (girintili).
 */
export async function downloadMemberExport(targetUid: string): Promise<MemberExport> {
  const data = await exportMemberData({ targetUid });
  downloadTextFile(exportFileName(data), JSON.stringify(data, null, 2), "application/json;charset=utf-8");
  return data;
}
