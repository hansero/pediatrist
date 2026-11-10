"use client";

import {
  getMultiFactorResolver,
  multiFactor,
  TotpMultiFactorGenerator,
  type Auth,
  type MultiFactorError,
  type MultiFactorResolver,
  type TotpSecret,
  type User,
  type UserCredential,
} from "firebase/auth";
import { AppError } from "@/lib/errors";

/**
 * Gerçek TOTP iki aşamalı doğrulama (F3.4, AUDIT C4, D5). Identity Platform TOTP; Authenticator
 * uygulamaları (Google Authenticator, Microsoft Authenticator, 1Password vb.) ile çalışır.
 *
 * Not: Firebase Auth emülatörü TOTP'yi desteklemez (F3.4'te denendi: `Missing phoneEnrollmentInfo`).
 * Emülatörde zorunluluk kapalıdır (`NEXT_PUBLIC_REQUIRE_MFA=false`); bu akış birim testleri ve staging'de
 * elle sınanır (REVISION_PLAN F10.3).
 */

/**
 * İstemcide MFA zorunlu mu? Güvenli varsayılan: yalnızca açıkça `"false"` ise kapalı
 * (sunucudaki `guards.ts → isEnforced` ile aynı mantık, N5). Sunucu zorunluluğu `REQUIRE_MFA` ile ayrıca uygular.
 */
export function isMfaRequired(value: string | undefined = process.env.NEXT_PUBLIC_REQUIRE_MFA): boolean {
  return value?.trim().toLowerCase() !== "false";
}

export const TOTP_ISSUER = "Pediatrist";
export const TOTP_CODE_RE = /^\d{6}$/;

/** Kullanıcının girdiği kodu normalize eder (boşluklar/tireler atılır) ve 6 hane değilse Türkçe hata verir. */
export function normalizeTotpCode(raw: string): string {
  const code = raw.replace(/[\s-]/g, "");
  if (!TOTP_CODE_RE.test(code)) {
    throw new AppError("invalid-argument", "Doğrulama kodu 6 haneli bir sayı olmalı.");
  }
  return code;
}

/** Giriş sırasında ikinci adım gerekiyor mu? Gerekiyorsa çözümleyici döner. */
export function mfaResolverFrom(auth: Auth, err: unknown): MultiFactorResolver | null {
  if ((err as { code?: unknown })?.code !== "auth/multi-factor-auth-required") return null;
  return getMultiFactorResolver(auth, err as MultiFactorError);
}

/** Çözümleyicideki TOTP faktörü. Hesapta yalnızca başka tür (ör. SMS) varsa açık hata. */
export function totpHint(resolver: MultiFactorResolver) {
  const hint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!hint) {
    throw new AppError(
      "failed-precondition",
      "Hesabınızda Authenticator doğrulaması bulunamadı. Eğitim sorumlusuyla iletişime geçin."
    );
  }
  return hint;
}

/** İkinci adımı Authenticator koduyla tamamlar. */
export async function completeTotpSignIn(resolver: MultiFactorResolver, rawCode: string): Promise<UserCredential> {
  const code = normalizeTotpCode(rawCode);
  const hint = totpHint(resolver);
  return resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code));
}

export interface TotpEnrollment {
  secret: TotpSecret;
  /** Elle girmek için gizli anahtar, 4'lü gruplar halinde. */
  displayKey: string;
  /** `otpauth://` adresi (QR koduna dönüştürülür). */
  otpauthUrl: string;
}

/** Kayıt adım 1: gizli anahtarı üretir. E-posta doğrulanmış ve oturum yeni olmalı (Identity Platform kuralı). */
export async function startTotpEnrollment(user: User): Promise<TotpEnrollment> {
  const session = await multiFactor(user).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  return {
    secret,
    displayKey: secret.secretKey.replace(/(.{4})/g, "$1 ").trim(),
    otpauthUrl: secret.generateQrCodeUrl(user.email ?? user.uid, TOTP_ISSUER),
  };
}

/** Kayıt adım 2: uygulamanın ürettiği kodla kaydı tamamlar. */
export async function finishTotpEnrollment(
  user: User,
  enrollment: TotpEnrollment,
  rawCode: string,
  displayName = "Authenticator"
): Promise<void> {
  const code = normalizeTotpCode(rawCode);
  await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(enrollment.secret, code), displayName);
}

export interface EnrolledFactorView {
  uid: string;
  displayName: string;
  factorId: string;
  enrolledAt: string;
}

export function enrolledFactors(user: User): EnrolledFactorView[] {
  return multiFactor(user).enrolledFactors.map((f) => ({
    uid: f.uid,
    displayName: f.displayName ?? "Authenticator",
    factorId: f.factorId,
    enrolledAt: f.enrollmentTime,
  }));
}

export async function unenrollFactor(user: User, factorUid: string): Promise<void> {
  await multiFactor(user).unenroll(factorUid);
}
