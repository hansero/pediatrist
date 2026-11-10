import { onCall } from "firebase-functions/v2/https";
import { requireActive, requireAdmin, requireSignedIn, type MemberContext, type SignedInContext } from "./guards";
import { REGION } from "./shared/constants";
import { CALLABLES, type CallableName, type CallableRequestData, type CallableResponse } from "./shared/schemas";
import { parse } from "./validate";

/**
 * - "admin":    aktif Eğitim Sorumlusu
 * - "member":   aktif üye
 * - "signedIn": yalnızca oturum (profil şartı yok) — YALNIZCA `completeRegistration` için
 */
export type Access = "admin" | "member" | "signedIn";
type ContextFor<A extends Access> = A extends "signedIn" ? SignedInContext : MemberContext;

/**
 * Callable tanımlayıcı: her callable aynı sırayla korunur.
 *  1) yetki (`guards.ts`: oturum, App Check, aktif üyelik, gerekiyorsa admin) — doğrulama hatası
 *     yetkisiz kullanıcıya şema ayrıntısı sızdırmasın diye ÖNCE yetki,
 *  2) istek doğrulaması (`shared/schemas.ts` → `CALLABLES[name].request`),
 *  3) handler (dönüş tipi `CALLABLES[name].response` ile uyumlu olmak zorunda).
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
  return onCall({ region: REGION }, async (request) => {
    const ctx =
      access === "admin"
        ? await requireAdmin(request)
        : access === "member"
          ? await requireActive(request)
          : requireSignedIn(request);
    const data = parse(contract.request, request.data) as CallableRequestData<N>;
    return handler(data, ctx as ContextFor<A>);
  });
}
