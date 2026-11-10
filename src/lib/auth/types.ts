import type { MemberStatus, Role } from "@shared/constants";

/**
 * İstemcideki oturum görünümü (UI için). Rol ve durum `users/{uid}` dokümanından gelir (D3);
 * bütün alanlar gerçek kaynaklardan okunur (F2.4'te `appCheckVerified` gibi doğrulanmamış alanlar kaldırıldı).
 */
export interface ClinicMemberSession {
  uid: string;
  email: string;
  fullName: string;
  title: string;
  residencyYear: number;
  role: Role;
  status: MemberStatus;
  /** Bu oturum ikinci faktörle (TOTP) açıldı mı? (ID token → `signInSecondFactor`) */
  mfaVerified: boolean;
  /** Hesapta kayıtlı ikinci faktör var mı? (`multiFactor(user).enrolledFactors`) */
  mfaEnrolled: boolean;
  /** Ham cihaz kimliği UI'a hiç taşınmaz; yalnızca "kayıtlı cihaz var mı" bilgisi tutulur. */
  hasBoundDevice: boolean;
}
