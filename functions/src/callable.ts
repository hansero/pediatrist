import { onCall } from "firebase-functions/v2/https";
import { requireActive, requireAdmin, type MemberContext } from "./guards";
import { REGION } from "./shared/constants";
import { CALLABLES, type CallableName, type CallableRequestData, type CallableResponse } from "./shared/schemas";
import { parse } from "./validate";

export type Access = "admin" | "member";

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
export function defineCallable<N extends CallableName>(
  name: N,
  access: Access,
  handler: (data: CallableRequestData<N>, ctx: MemberContext) => Promise<CallableResponse<N>>
) {
  const contract = CALLABLES[name];
  return onCall({ region: REGION }, async (request) => {
    const ctx = access === "admin" ? await requireAdmin(request) : await requireActive(request);
    const data = parse(contract.request, request.data) as CallableRequestData<N>;
    return handler(data, ctx);
  });
}
