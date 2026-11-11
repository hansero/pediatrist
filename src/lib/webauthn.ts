"use client";

import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import type { CallableRequestInput } from "@shared/schemas";
import { AppError } from "@/lib/errors";
import {
  beginAttendanceAssertion,
  beginDeviceRegistration,
  finishDeviceRegistration,
  verifyRealTimeAttendance,
} from "@/lib/firebase/callables";

/**
 * Yoklama cihazı: WebAuthn platform passkey'i (F4.2, D6). Telefonun yüz tanıma / parmak izi / ekran kilidi
 * ile imzalanır; özel anahtar cihazdan çıkmaz. Doğrulamanın tamamı sunucudadır (`functions/src/webauthn.ts`).
 * Eski `localStorage` cihaz sırrı kaldırıldı (Safari 7 günde siliyordu; gizli sekmeyle atlatılabiliyordu).
 */

export type PasskeySupport = "supported" | "no-platform-authenticator" | "unsupported";

/** Bu tarayıcı/cihaz platform passkey'i destekliyor mu? */
export async function passkeySupport(): Promise<PasskeySupport> {
  if (!browserSupportsWebAuthn()) return "unsupported";
  return (await platformAuthenticatorIsAvailable()) ? "supported" : "no-platform-authenticator";
}

/** Bu cihazı hesabın yoklama cihazı olarak kaydeder. Başarılıysa passkey bulut eşitlemeli mi döner. */
export async function registerAttendanceDevice(): Promise<{ backedUp: boolean }> {
  const { options } = await beginDeviceRegistration({});
  const response = await startRegistration({
    optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON,
  });
  const result = await finishDeviceRegistration({
    response: response as unknown as CallableRequestInput<"finishDeviceRegistration">["response"],
  });
  return { backedUp: result.backedUp };
}

/**
 * Yoklamada tarayıcının `NotAllowedError`'u iki durumda gelir: kullanıcı onayı iptal etti/zaman aşımı ya da bu
 * cihazda hesaba kayıtlı anahtar yok (başka telefon, sıfırlanmış cihaz). Tarayıcı ikisini ayırt ettirmez
 * (gizlilik); bu yüzden yoklamaya özgü mesaj ikisini de söyler ve çözümü gösterir (F4.6).
 */
export const ATTENDANCE_PASSKEY_MISSING =
  "Bu cihazda hesabınıza kayıtlı yoklama anahtarı bulunamadı ya da onay tamamlanmadı. Kayıtlı telefonunuzla tekrar deneyin; telefonunuz değiştiyse eğitim sorumlusundan cihaz sıfırlaması isteyin.";

export function attendancePasskeyError(err: unknown): unknown {
  return (err as { name?: unknown })?.name === "NotAllowedError"
    ? new AppError("failed-precondition", ATTENDANCE_PASSKEY_MISSING)
    : err;
}

/** Canlı derste yoklama: challenge al → cihazla imzala (yüz/parmak izi) → kod + imzayı gönder. */
export async function checkInWithPasskey(sessionId: string, code: string) {
  const { options } = await beginAttendanceAssertion({ sessionId });
  const assertion = await startAuthentication({
    optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON,
  }).catch((err: unknown) => {
    throw attendancePasskeyError(err);
  });
  return verifyRealTimeAttendance({
    sessionId,
    code,
    assertion: assertion as unknown as CallableRequestInput<"verifyRealTimeAttendance">["assertion"],
  });
}
