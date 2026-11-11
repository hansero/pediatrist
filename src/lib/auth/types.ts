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
  /** Asistanlar için 1–4; uzman/öğretim üyesi için `null` (F3.5). */
  residencyYear: number | null;
  role: Role;
  status: MemberStatus;
  /** Bu oturum ikinci faktörle (TOTP) açıldı mı? (ID token → `signInSecondFactor`) */
  mfaVerified: boolean;
  /** Hesapta kayıtlı ikinci faktör var mı? (`multiFactor(user).enrolledFactors`) */
  mfaEnrolled: boolean;
  /** E-posta doğrulandı mı? (Identity Platform, TOTP kaydından önce bunu şart koşar.) */
  emailVerified: boolean;
  /** Ortamda MFA zorunlu mu? (`config/security`, N8; kurallar ve sunucuyla aynı kaynak) */
  mfaRequired: boolean;
  /** Ortamda e-posta doğrulaması zorunlu mu? (`config/security`, D21) */
  emailVerificationRequired: boolean;
  /** Hesaba yoklama cihazı (passkey, F4.2) kayıtlı mı? Credential ayrıntısı UI'a taşınmaz. */
  hasBoundDevice: boolean;
  /** Onayladığı KVKK aydınlatma metni sürümü; hiç onaylamadıysa `null` (F9.1: güncel değilse onay istenir). */
  consentVersion: string | null;
}
