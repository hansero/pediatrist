import { ATTENDANCE_CODE_ALPHABET, ATTENDANCE_CODE_LENGTH } from "@shared/constants";

/**
 * Projektör QR'ındaki yoklama bağlantısı (F4.3, F11.2): `${origin}/attendance?s=<ders>&c=<kod>`.
 * Kurucu (projektör) ve çözücü (hekimin uygulama içi okuyucusu, telefonun kamerasıyla gelen bağlantı) tek yerde.
 */
export const CHECK_IN_PATH = "/attendance";

export function checkInUrl(origin: string, sessionId: string, code: string): string {
  const url = new URL(CHECK_IN_PATH, origin);
  url.searchParams.set("s", sessionId);
  url.searchParams.set("c", code);
  return url.toString();
}

export type CheckInLink =
  | { ok: true; sessionId: string; code: string }
  /** `not-url`: metin bağlantı değil; `foreign`: başka site ya da sayfa; `bad-code`: ders/kod eksik veya geçersiz. */
  | { ok: false; reason: "not-url" | "foreign" | "bad-code" };

/** Kodu büyük harfe çevirir; uzunluk ve alfabe (`ATTENDANCE_CODE_*`) tutmuyorsa `null`. */
export function normalizeAttendanceCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  if (code.length !== ATTENDANCE_CODE_LENGTH) return null;
  return [...code].every((ch) => ATTENDANCE_CODE_ALPHABET.includes(ch)) ? code : null;
}

/**
 * QR metnini çözer. Yalnızca bu uygulamanın kökenindeki yoklama sayfasına giden bağlantı kabul edilir
 * (başka bir sitenin QR'ı yoklama koduna dönüşmez).
 */
export function parseCheckInLink(text: string, origin: string): CheckInLink {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return { ok: false, reason: "not-url" };
  }
  if (url.origin !== new URL(origin).origin || url.pathname.replace(/\/+$/, "") !== CHECK_IN_PATH) {
    return { ok: false, reason: "foreign" };
  }
  const sessionId = url.searchParams.get("s")?.trim() ?? "";
  const code = normalizeAttendanceCode(url.searchParams.get("c") ?? "");
  if (!sessionId || !code) return { ok: false, reason: "bad-code" };
  return { ok: true, sessionId, code };
}
