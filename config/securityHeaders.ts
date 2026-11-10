import { REGION } from "../functions/src/shared/constants";

/**
 * Güvenlik başlıklarının ve Content-Security-Policy'nin TEK kaynağı (F2.5, AUDIT C6).
 *
 * `next.config.ts` → `headers()` bu fonksiyonu çağırır. Firebase Hosting (webframeworks) Next'in
 * `routes-manifest` başlıklarını kendi CDN yapılandırmasına aktarır; bu yüzden `firebase.json` içinde
 * başlık TANIMLANMAZ (iki kopya zamanla ayrışıyordu). Eşitlik `tests/unit/securityHeaders.test.ts`'te denetlenir.
 *
 * İzin listesi, uygulamanın gerçekten kullandığı Firebase uç noktalarından türetilmiştir:
 *  - Auth (e-posta/şifre, TOTP MFA): identitytoolkit + securetoken. Açılır pencere/yönlendirme ile giriş
 *    KULLANILMAZ; istemci `initializeAuth` ile resolver'sız başlatılır (bkz. `src/lib/firebase/client.ts`),
 *    böylece `apis.google.com` betiği ve authDomain iframe'i hiç yüklenmez.
 *  - Firestore: firestore.googleapis.com (WebChannel). Realtime Database kullanılmaz (firebaseio.com yok).
 *  - Storage: firebasestorage.googleapis.com (yükleme, indirme URL'leri; görsel, video, PDF).
 *  - Cloud Functions (callable): https://{REGION}-{projectId}.cloudfunctions.net.
 *  - App Check (reCAPTCHA Enterprise): betik www.google.com/recaptcha + www.gstatic.com/recaptcha,
 *    çerçeve www.google.com/recaptcha + recaptcha.google.com/recaptcha, token takası
 *    content-firebaseappcheck.googleapis.com.
 *  - Yazı tipleri: Google Fonts geçici olarak; F3.1'de `next/font` ile kendi sunucumuzdan sunulunca kaldırılır.
 *
 * Bilinçli açık kalanlar:
 *  - `script-src 'unsafe-inline'`: Next.js App Router hidrasyon betikleri satır içi. Nonce tabanlı
 *    politika dinamik render gerektirir; F8.2'de değerlendirilir.
 *  - `style-src 'unsafe-inline'`: React `style` öznitelikleri (F3.1 satır içi stilleri azaltır).
 */

export interface SecurityHeaderOptions {
  /** `next dev` (React Refresh `eval` kullanır). */
  isDev: boolean;
  /** İstemci yerel Firebase emülatörlerine bağlanır (`NEXT_PUBLIC_USE_EMULATORS=true`). */
  useEmulators: boolean;
  /** `NEXT_PUBLIC_FIREBASE_PROJECT_ID`; callable uç noktasını daraltmak için. */
  projectId?: string;
}

export type CspDirectives = Record<string, string[]>;

const RECAPTCHA_SCRIPTS = ["https://www.google.com/recaptcha/", "https://www.gstatic.com/recaptcha/"];
const RECAPTCHA_FRAMES = ["https://www.google.com/recaptcha/", "https://recaptcha.google.com/recaptcha/"];
const STORAGE = "https://firebasestorage.googleapis.com";
const LOCAL_HTTP = ["http://127.0.0.1:*", "http://localhost:*"];
const LOCAL_WS = ["ws://127.0.0.1:*", "ws://localhost:*"];

/** Callable uç noktası. Proje kimliği bilinmiyorsa bölge-bağımsız joker (CSP yalnızca en soldaki etikette joker kabul eder). */
export function functionsOrigin(projectId?: string): string {
  const id = projectId?.trim();
  return id && /^[a-z0-9-]+$/.test(id) ? `https://${REGION}-${id}.cloudfunctions.net` : "https://*.cloudfunctions.net";
}

export function buildCspDirectives({ isDev, useEmulators, projectId }: SecurityHeaderOptions): CspDirectives {
  const csp: CspDirectives = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "script-src": ["'self'", "'unsafe-inline'", ...RECAPTCHA_SCRIPTS],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com"],
    "img-src": ["'self'", "data:", "blob:", STORAGE],
    "media-src": ["'self'", "blob:", STORAGE],
    "worker-src": ["'self'", "blob:"],
    "frame-src": [...RECAPTCHA_FRAMES],
    "connect-src": [
      "'self'",
      "https://identitytoolkit.googleapis.com",
      "https://securetoken.googleapis.com",
      "https://firestore.googleapis.com",
      STORAGE,
      "https://content-firebaseappcheck.googleapis.com",
      functionsOrigin(projectId),
    ],
    "manifest-src": ["'self'"],
  };

  if (isDev) csp["script-src"].push("'unsafe-eval'");

  if (useEmulators) {
    csp["connect-src"].push(...LOCAL_HTTP, ...LOCAL_WS);
    csp["img-src"].push(...LOCAL_HTTP);
    csp["media-src"].push(...LOCAL_HTTP);
  }
  // `upgrade-insecure-requests` bilinçli olarak yok: Firebase Hosting zaten yalnızca HTTPS sunar (HSTS),
  // yerelde `next start` (http://localhost) ile ise aynı kökenli varlıkları https'e çevirip bozar.
  return csp;
}

export function serializeCsp(directives: CspDirectives): string {
  return Object.entries(directives)
    .map(([directive, sources]) => [directive, ...sources].join(" "))
    .join("; ");
}

export interface HeaderEntry {
  key: string;
  value: string;
}

export function buildSecurityHeaders(options: SecurityHeaderOptions): HeaderEntry[] {
  return [
    { key: "Content-Security-Policy", value: serializeCsp(buildCspDirectives(options)) },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Açılır pencereyle giriş kullanılmadığı için (bkz. üstteki not) en sıkı değer güvenli.
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      // camera: F4.4 QR tarama; wake lock + fullscreen: F4.3 projektör; publickey-credentials: F4.2 passkey.
      value: [
        "camera=(self)",
        "microphone=()",
        "geolocation=()",
        "payment=()",
        "usb=()",
        "screen-wake-lock=(self)",
        "fullscreen=(self)",
        "publickey-credentials-create=(self)",
        "publickey-credentials-get=(self)",
      ].join(", "),
    },
  ];
}
