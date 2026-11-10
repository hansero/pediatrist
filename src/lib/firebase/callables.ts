"use client";

import { httpsCallable } from "firebase/functions";
import { formatIssues } from "@shared/issues";
import { CALLABLES, type CallableName, type CallableRequestInput, type CallableResponse } from "@shared/schemas";
import { AppError, toAppError } from "@/lib/errors";
import { initPediatristFirebase, isFirebaseConfigured } from "@/lib/firebase/client";

export { toUserMessage } from "@/lib/errors";

/**
 * Sunucu çağrı katmanı (F1.4). Bütün yazma işlemleri Cloud Functions üzerinden yapılır.
 *
 * Her çağrı:
 *  1) isteği GÖNDERMEDEN ÖNCE ortak şemayla doğrular (anında Türkçe hata; geçersiz istek ağa çıkmaz)
 *     ve normalize edilmiş halini gönderir (sunucu yine de yeniden doğrular),
 *  2) yanıtı aynı sözleşmenin yanıt şemasıyla doğrular (sunucu ile istemci ayrışırsa sessizce yanlış veri
 *     göstermek yerine `bad-response` hatası),
 *  3) her hatayı `AppError`'a çevirir; ekranda gösterilecek metin `toUserMessage()` ile alınır.
 *
 * Bu katman hiçbir koşulda "sahte başarı" üretmez (CLAUDE.md kural 2).
 */
export async function callFunction<N extends CallableName>(
  name: N,
  data: CallableRequestInput<N>
): Promise<CallableResponse<N>> {
  const contract = CALLABLES[name];

  const request = contract.request.safeParse(data);
  if (!request.success) {
    throw new AppError("invalid-argument", formatIssues(request.error.issues), request.error.issues);
  }

  const clients = initPediatristFirebase();
  if (!clients) throw new AppError("not-configured", "Sunucu bağlantısı yapılandırılmamış.");

  let raw: unknown;
  try {
    raw = (await httpsCallable(clients.functions, name)(request.data)).data;
  } catch (err) {
    throw toAppError(err);
  }

  const response = contract.response.safeParse(raw);
  if (!response.success) {
    console.error(`[callables] ${name}: yanıt sözleşmeye uymuyor`, response.error.issues);
    throw new AppError("bad-response", "Sunucudan beklenmeyen bir yanıt alındı. Lütfen sayfayı yenileyin.");
  }
  return response.data as CallableResponse<N>;
}

const bind =
  <N extends CallableName>(name: N) =>
  (data: CallableRequestInput<N>) =>
    callFunction(name, data);

// --- Adlandırılmış çağrılar (tipleri `functions/src/shared/schemas.ts` → CALLABLES'tan) ---
export const updateMemberAccess = bind("updateMemberAccess");
export const startLectureSession = bind("startLectureSession");
export const endLectureSession = bind("endLectureSession");
export const getProjectorCode = bind("getProjectorCode");
export const verifyRealTimeAttendance = bind("verifyRealTimeAttendance");
export const markAttendanceExcused = bind("markAttendanceExcused");
export const saveQuizDraft = bind("saveQuizDraft");
export const publishQuiz = bind("publishQuiz");
export const closeQuiz = bind("closeQuiz");
export const startQuizAttempt = bind("startQuizAttempt");
export const submitQuizAttempt = bind("submitQuizAttempt");

/**
 * Kişisel cihaz bağlama için yerel tarayıcıda rastgele sır üretir ve saklar.
 * Ham sır ekranda gösterilmez; sunucuda SHA-256 özeti (`boundDeviceHash`) tutulur.
 *
 * @deprecated F4.2'de WebAuthn passkey ile değiştirilecek (localStorage Safari'de 7 gün sonra silinebilir).
 */
export function getOrCreateClientDeviceSecret(): string {
  if (typeof window === "undefined") throw new Error("Cihaz sırrı yalnızca tarayıcıda üretilebilir.");
  const storageKey = "pediatrist_device_secret_v1";
  let existing = window.localStorage.getItem(storageKey);
  if (!existing || existing.length < 16) {
    const bytes = new Uint8Array(24);
    window.crypto.getRandomValues(bytes);
    existing = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    window.localStorage.setItem(storageKey, existing);
  }
  return existing;
}

/**
 * @deprecated SESSİZ SAHTE BAŞARI (AUDIT C1). Yalnızca henüz yeniden yazılmamış mock sayfalarda duruyor.
 * Çağrı yeri kalmayınca F7.5'te silinir; `check:no-mock` bekçisi yeni kullanımı engeller.
 * Hatayı artık en azından konsola yazar. Yeni kodda `callFunction` + `useAsyncAction` kullanın.
 */
export async function invokeWithFallback<Res>(
  thunk: () => Promise<Res>,
  fallbackFn: () => unknown
): Promise<{ data: Res; syncedWithCloud: boolean }> {
  if (!isFirebaseConfigured()) {
    return { data: (await fallbackFn()) as Res, syncedWithCloud: false };
  }
  try {
    return { data: await thunk(), syncedWithCloud: true };
  } catch (err) {
    console.error("[invokeWithFallback] Sunucu çağrısı başarısız; sahte veri gösteriliyor (C1):", toAppError(err));
    return { data: (await fallbackFn()) as Res, syncedWithCloud: false };
  }
}
