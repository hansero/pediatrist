import type { MemberStatus, Role } from "@shared/constants";

/**
 * İstemcideki oturum görünümü (UI için). Rol ve durum tipleri ortak modülden gelir.
 * F2.4'te `ClinicSessionContext` yeniden yazılırken `mfaVerified` / `appCheckVerified` gibi
 * doğrulanmamış alanlar kaldırılır (AUDIT C4).
 */
export interface ClinicMemberSession {
  uid: string;
  email: string;
  fullName: string;
  title: string;
  residencyYear: number;
  role: Role;
  status: MemberStatus;
  mfaVerified: boolean;
  appCheckVerified: boolean;
  /** Ham cihaz kimliği UI'a hiç taşınmaz; yalnızca "kayıtlı cihaz var mı" bilgisi tutulur. */
  hasBoundDevice: boolean;
}
