import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { getFirestore, type Timestamp } from "firebase-admin/firestore";
import { ENFORCE_APP_CHECK, REQUIRE_EMAIL_VERIFIED, REQUIRE_MFA } from "./config";
import { COLLECTIONS, type MemberDoc } from "./shared/types";

/**
 * Callable yetki kontrollerinin TEK yeri (CLAUDE.md kural 3).
 *
 * Yetkinin kaynağı `users/{uid}` dokümanıdır (D3). Custom claims yalnızca önbellektir; askıya alınan
 * bir üyenin elindeki eski "active" token (1 saat geçerli) bu kontrolleri geçemez (AUDIT C5).
 */

export interface MemberContext {
  uid: string;
  email: string;
  profile: MemberDoc<Timestamp>;
}

/**
 * Güvenlik parametresi açık mı? GÜVENLİ VARSAYILAN: yalnızca değer açıkça "false" ise kapalıdır.
 *
 * Not: `defineBoolean(...).value()` ortam değişkeni yoksa `false` döner (varsayılan değer yalnızca
 * deploy sırasında kullanılır). Yanlış yapılandırılmış bir ortamda App Check / MFA sessizce kapanmasın diye
 * burada `.value()` yerine bu kural uygulanır. Emülatörde `functions/.env.demo-pediatrist` "false" verir.
 */
export function isEnforced(param: { name: string }): boolean {
  return process.env[param.name] !== "false";
}

/** Oturum + (zorunluysa) App Check. */
export function requireAuth(request: CallableRequest<unknown>) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Oturum açmanız gerekiyor.");
  }
  if (isEnforced(ENFORCE_APP_CHECK) && !request.app) {
    throw new HttpsError("unauthenticated", "Uygulama doğrulaması başarısız oldu. Sayfayı yenileyip tekrar deneyin.");
  }
  return request.auth;
}

/** Oturum açmış ama henüz profili olmayabilecek kullanıcı (yalnızca kayıt tamamlama için). */
export interface SignedInContext {
  uid: string;
  /** Firebase Auth'taki e-posta (küçük harf). E-postasız hesaplar kayıt olamaz. */
  email: string | null;
  emailVerified: boolean;
}

/** Profil şartı olmadan oturum + (zorunluysa) App Check. Kayıt tamamlama dışında kullanılmaz. */
export function requireSignedIn(request: CallableRequest<unknown>): SignedInContext {
  const auth = requireAuth(request);
  const email = typeof auth.token.email === "string" ? auth.token.email.toLowerCase() : null;
  return { uid: auth.uid, email, emailVerified: auth.token.email_verified === true };
}

/** Aktif üye: doküman `active`, oturum iptal zamanından sonra açılmış, (zorunluysa) e-posta doğrulanmış ve MFA'lı. */
export async function requireActive(request: CallableRequest<unknown>): Promise<MemberContext> {
  const auth = requireAuth(request);
  const snap = await getFirestore().collection(COLLECTIONS.users).doc(auth.uid).get();
  const profile = snap.data() as MemberDoc<Timestamp> | undefined;

  if (!profile) {
    throw new HttpsError("permission-denied", "Üyelik kaydınız bulunamadı.");
  }
  if (profile.status !== "active") {
    throw new HttpsError(
      "permission-denied",
      profile.status === "suspended"
        ? "Üyeliğiniz askıya alınmış. Eğitim sorumlusuyla iletişime geçin."
        : "Üyeliğiniz henüz onaylanmadı."
    );
  }
  const validAfter = Number(profile.tokensValidAfter ?? 0);
  if (validAfter > 0 && Number(auth.token.auth_time ?? 0) <= validAfter) {
    throw new HttpsError("unauthenticated", "Oturumunuz sonlandırıldı. Lütfen yeniden giriş yapın.");
  }
  if (isEnforced(REQUIRE_EMAIL_VERIFIED) && auth.token.email_verified !== true) {
    throw new HttpsError("permission-denied", "Devam etmek için e-posta adresinizi doğrulamanız gerekiyor.");
  }
  if (isEnforced(REQUIRE_MFA) && !auth.token.firebase?.sign_in_second_factor) {
    throw new HttpsError("permission-denied", "Bu işlem için iki aşamalı doğrulama ile giriş yapmanız gerekiyor.");
  }

  return { uid: auth.uid, email: auth.token.email ?? profile.email ?? "unknown", profile };
}

/** Aktif Eğitim Sorumlusu (admin). */
export async function requireAdmin(request: CallableRequest<unknown>): Promise<MemberContext> {
  const ctx = await requireActive(request);
  if (ctx.profile.role !== "admin") {
    throw new HttpsError("permission-denied", "Bu işlem yalnızca Eğitim Sorumlusu (Admin) yetkisiyle yapılabilir.");
  }
  return ctx;
}
