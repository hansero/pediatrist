import { onCall } from "firebase-functions/v2/https";
import {
  requireActive,
  requireAdmin,
  requireAttendee,
  requireSignedIn,
  type MemberContext,
  type SignedInContext,
} from "./guards";
import { AUDIT_IP_SALT } from "./config";
import { contextOf, runWithContext } from "./requestContext";
import { REGION } from "./shared/constants";
import { CALLABLES, type CallableName, type CallableRequestData, type CallableResponse } from "./shared/schemas";
import { parse } from "./validate";

/**
 * - "admin":    aktif Eğitim Sorumlusu
 * - "member":   aktif üye
 * - "attendee": yoklama veren üye: aktif, hekim rolünde 1.–4. yıl asistan (D24)
 * - "signedIn": yalnızca oturum (profil şartı yok) — YALNIZCA `completeRegistration` için
 */
export type Access = "admin" | "member" | "attendee" | "signedIn";
type ContextFor<A extends Access> = A extends "signedIn" ? SignedInContext : MemberContext;

/**
 * Callable tanımlayıcı: her callable aynı sırayla korunur.
 *  1) yetki (`guards.ts`: oturum, App Check, aktif üyelik, gerekiyorsa admin) — doğrulama hatası
 *     yetkisiz kullanıcıya şema ayrıntısı sızdırmasın diye ÖNCE yetki,
 *  2) istek doğrulaması (`shared/schemas.ts` → `CALLABLES[name].request`),
 *  3) handler (dönüş tipi `CALLABLES[name].response` ile uyumlu olmak zorunda).
 * Bütün adımlar istek bağlamında çalışır: yazılan denetim kayıtları ağın tuzlu özetini taşır (F9.2).
 *
 * App Check zorunluluğu `onCall({ enforceAppCheck })` ile değil `guards.ts` içinde parametreye göre uygulanır
 * (`enforceAppCheck` yalnızca sabit boolean kabul ediyor; bkz. config.ts).
 */
export function defineCallable<N extends CallableName, A extends Access>(
  name: N,
  access: A,
  handler: (data: CallableRequestData<N>, ctx: ContextFor<A>) => Promise<CallableResponse<N>>
) {
  const contract = CALLABLES[name];
  // `secrets`: denetim kaydındaki IP özetinin tuzu her callable'a bağlanır (F9.2).
  return onCall({ region: REGION, secrets: [AUDIT_IP_SALT] }, (request) =>
    // İstek bağlamı (IP özeti, tarayıcı): bu isteğin yazdığı bütün denetim kayıtlarına eklenir.
    runWithContext(contextOf(request), async () => {
      const ctx =
        access === "admin"
          ? await requireAdmin(request)
          : access === "member"
            ? await requireActive(request)
            : access === "attendee"
              ? await requireAttendee(request)
              : requireSignedIn(request);
      const data = parse(contract.request, request.data) as CallableRequestData<N>;
      return handler(data, ctx as ContextFor<A>);
    })
  );
}
