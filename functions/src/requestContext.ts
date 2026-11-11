import { AsyncLocalStorage } from "node:async_hooks";
import * as crypto from "node:crypto";
import type { CallableRequest } from "firebase-functions/v2/https";
import { AUDIT_IP_SALT } from "./config";

/**
 * İstek bağlamı (F9.2): denetim kayıtlarına, isteğin geldiği ağın TUZLU özeti (`ipHash`) ve tarayıcı bilgisi
 * eklenir. Ham IP adresi hiçbir yere yazılmaz. `defineCallable` her isteği bu bağlamda çalıştırır;
 * `auditLogger` buradan okur. Zamanlanmış işlerde ve tetikleyicilerde bağlam yoktur (alanlar yazılmaz).
 */
export interface RequestContext {
  ipHash: string | null;
  userAgent: string | null;
}

const storage = new AsyncLocalStorage<RequestContext>();
const MIN_SALT_LENGTH = 16;
const USER_AGENT_MAX = 200;

/**
 * İstemcinin IP adresi. Cloud Functions v2 (Cloud Run) önündeki Google ön ucu gerçek istemci adresini
 * `X-Forwarded-For` başlığının SONUNA ekler; baştaki değerler istemcinin kendi gönderdiği (sahte olabilecek)
 * değerlerdir. Bu yüzden son değer alınır; başlık yoksa (emülatör) bağlantı adresi kullanılır.
 */
export function clientIp(raw: { headers?: Record<string, unknown>; ip?: string } | undefined): string | null {
  const header = raw?.headers?.["x-forwarded-for"];
  const forwarded = Array.isArray(header) ? header.join(",") : typeof header === "string" ? header : "";
  const last = forwarded
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .pop();
  return last || raw?.ip || null;
}

/**
 * Tuzlu IP özeti. Tuz yoksa ya da kısaysa özet ÜRETİLMEZ: IPv4 uzayı küçük olduğundan tuzsuz özet geri
 * çevrilebilir ve kişisel veriyi korumaz. 32 onaltılık karakter (128 bit) eşleştirme için yeterlidir.
 */
export function hashIp(ip: string | null, salt = process.env[AUDIT_IP_SALT.name]): string | null {
  if (!ip || !salt || salt.length < MIN_SALT_LENGTH) return null;
  return crypto.createHmac("sha256", salt).update(ip).digest("hex").slice(0, 32);
}

export function contextOf(request: CallableRequest<unknown>): RequestContext {
  const raw = request.rawRequest as unknown as { headers?: Record<string, unknown>; ip?: string } | undefined;
  const agent = raw?.headers?.["user-agent"];
  return {
    ipHash: hashIp(clientIp(raw)),
    userAgent: typeof agent === "string" && agent ? agent.slice(0, USER_AGENT_MAX) : null,
  };
}

export function runWithContext<T>(context: RequestContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(context, fn);
}

export function currentContext(): RequestContext | undefined {
  return storage.getStore();
}
