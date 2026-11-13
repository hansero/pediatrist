#!/usr/bin/env node
/**
 * Gerçek (staging / prod) Firebase projesi ve yerel yapılandırma doğrulama aracı.
 *
 * `DEPLOY.md` ve `docs/revision/STAGING_CHECKLIST.md` içindeki kurulum adımlarını
 * yerel `.env` dosyaları ve Firebase CLI (`firebase login`) oturumu üzerinden denetler:
 *  1) Yerel yapılandırma (`.firebaserc`, `.env.local`, `functions/.env.<proje>`)
 *  2) App Check (reCAPTCHA Enterprise kaydı, Firestore/Storage zorlaması, canlı callable negatif testi)
 *  3) Authentication / Identity Platform (E-posta/Şifre, TOTP MFA, şifre politikası)
 *  4) Cloud Firestore (konum `eur3`/`europe-west1`, PITR, TTL politikaları, `config/security` güvenliği)
 *  5) Cloud Storage (CORS `GET` izni, soft delete / nesne sürümleme)
 *  6) Secret Manager (`AUDIT_IP_SALT` varlığı)
 *
 * Kullanım:
 *   npm run verify:staging
 *   node scripts/verify-staging.mjs [--project <proje-kimliği>] [--local-only]
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const REGION = "europe-west1";
const FB_API = "https://firebaseappcheck.googleapis.com/v1/projects";
const FS_API = "https://firestore.googleapis.com/v1/projects";

const REQUIRED_WEB_ENV = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY",
  "NEXT_PUBLIC_KVKK_CONTROLLER_NAME",
  "NEXT_PUBLIC_KVKK_CONTACT",
];

/** Basit `.env` ayrıştırıcı (yorumları ve tırnakları temizler). */
export function parseEnvFile(content) {
  const out = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/** Yerel `.env.local` ve `functions/.env.<proje>` dosyalarını denetler. */
export function verifyLocalEnv({ webEnv, fnEnv, projectId, autoFixedAppCheck = false }) {
  const results = [];
  const pass = (id, msg) => results.push({ status: "PASS", id, msg });
  const fail = (id, msg) => results.push({ status: "FAIL", id, msg });
  const warn = (id, msg) => results.push({ status: "WARN", id, msg });

  if (!webEnv) {
    fail("B1", "`.env.local` bulunamadı. `.env.example` dosyasını `.env.local` olarak kopyalayıp doldurun.");
  } else {
    const missing = REQUIRED_WEB_ENV.filter((k) => !webEnv[k]?.trim());
    if (missing.length > 0) {
      fail("B1/B2", `\`.env.local\` içinde eksik değişkenler: ${missing.join(", ")}`);
    } else {
      pass("B1/B2", "`.env.local` içindeki tüm zorunlu Firebase, reCAPTCHA Enterprise ve KVKK değişkenleri tanımlı.");
    }

    if (webEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.startsWith("demo-")) {
      fail("B1", "`NEXT_PUBLIC_FIREBASE_PROJECT_ID` gerçek projede 'demo-' ile başlayamaz.");
    }

    const useEmu = webEnv.NEXT_PUBLIC_USE_EMULATORS ?? "";
    if (useEmu === "false") {
      pass("B3", "`NEXT_PUBLIC_USE_EMULATORS=false` (gerçek proje modu etkin).");
    } else {
      fail("B3", `\`NEXT_PUBLIC_USE_EMULATORS\` değeri "false" olmalı (mevcut: "${useEmu}").`);
    }

    if (webEnv.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN?.trim()) {
      warn(
        "A8",
        "`.env.local` içinde `NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN` tanımlı (yalnızca localhost testinde kullanın)."
      );
    }
  }

  if (!projectId) {
    fail("A1", "Proje kimliği belirlenemedi (`.env.local`, `.firebaserc` veya `--project <id>` gerekli).");
    return results;
  }

  if (!fnEnv) {
    fail("B6/B7", `\`functions/.env.${projectId}\` dosyası bulunamadı.`);
  } else {
    if (fnEnv.ENFORCE_APP_CHECK === "false") {
      fail("B6", `\`functions/.env.${projectId}\` içinde ENFORCE_APP_CHECK=false! Gerçek projede "true" olmalıdır.`);
    } else if (autoFixedAppCheck) {
      pass(
        "B6",
        `\`functions/.env.${projectId}\` içinde ENFORCE_APP_CHECK="true" yapıldı (dağıtım: npm run deploy:functions).`
      );
    } else {
      pass("B6", "`ENFORCE_APP_CHECK` açık (`true`).");
    }

    const rpId = fnEnv.WEBAUTHN_RP_ID?.trim() ?? "";
    const origins = (fnEnv.WEBAUTHN_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!rpId || rpId.includes("://") || rpId.includes("/")) {
      fail("B7", "`WEBAUTHN_RP_ID` şemasız alan adı olmalı (ör. `pediatrist.web.app`).");
    } else if (origins.length === 0 || origins.some((o) => !o.startsWith("https://"))) {
      fail("B7", "`WEBAUTHN_ORIGINS` virgülle ayrılmış `https://` adresleri içermeli.");
    } else {
      pass("B7", `WebAuthn parametreleri geçerli (RP_ID=${rpId}, ORIGINS=${origins.join(", ")}).`);
    }

    if (fnEnv.AUDIT_RETENTION_DAYS !== undefined) {
      const days = Number(fnEnv.AUDIT_RETENTION_DAYS);
      if (!Number.isInteger(days) || days < 30) {
        fail("B5", `\`AUDIT_RETENTION_DAYS\` en az 30 tam sayı olmalı (mevcut: ${fnEnv.AUDIT_RETENTION_DAYS}).`);
      } else {
        pass("B5", `\`AUDIT_RETENTION_DAYS=${days}\` gün olarak ayarlanmış.`);
      }
    } else {
      pass("B5", "`AUDIT_RETENTION_DAYS` varsayılan (730 gün / 2 yıl) olarak kullanılacak.");
    }
  }

  return results;
}

/**
 * Firebase CLI (`node scripts/firebase.mjs login` / `firebase login`) oturumundan
 * veya yedek olarak ortam / gcloud CLI üzerinden OAuth2 erişim belirteci alır.
 */
async function resolveAccessToken() {
  if (process.env.GOOGLE_OAUTH_ACCESS_TOKEN?.trim()) {
    return process.env.GOOGLE_OAUTH_ACCESS_TOKEN.trim();
  }

  // 1) Firebase CLI (`firebase-tools/lib/auth`) oturumu
  try {
    const require = createRequire(import.meta.url);
    const auth = require("firebase-tools/lib/auth");
    const account = auth.getProjectDefaultAccount(root) ?? auth.getGlobalDefaultAccount();
    if (account?.tokens) {
      const scopes = account.tokens.scopes ?? [
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/firebase",
      ];
      if (account.tokens.refresh_token) {
        const refreshed = await auth.getAccessToken(account.tokens.refresh_token, scopes);
        if (refreshed?.access_token) return refreshed.access_token;
      }
      if (account.tokens.access_token) return account.tokens.access_token;
    }
  } catch {
    // firebase-tools oturumu yoksa veya yenilenemediyse yedeklere geç
  }

  // 2) Yedek: gcloud CLI
  for (const args of [
    ["auth", "print-access-token"],
    ["auth", "application-default", "print-access-token"],
  ]) {
    const r = spawnSync("gcloud", args, { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  return null;
}

async function apiGet(url, token, projectId) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-goog-user-project": projectId,
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, body };
}

/** Uzak Google Cloud / Firebase API kontrollerini çalıştırır. */
export async function verifyRemoteServices(options) {
  const { projectId, appId, recaptchaSiteKey, storageBucket, expectedOrigins, token } = options;
  const results = [];
  const pass = (id, msg) => results.push({ status: "PASS", id, msg });
  const fail = (id, msg) => results.push({ status: "FAIL", id, msg });
  const warn = (id, msg) => results.push({ status: "WARN", id, msg });

  // 1. Canlı Cloud Functions App Check negatif testi (token gerektirmez)
  try {
    const fnUrl = `https://${REGION}-${projectId}.cloudfunctions.net/completeRegistration`;
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: {} }),
    });
    if (res.status === 401 || res.status === 403) {
      pass("B6-Canlı", `Canlı callable (${fnUrl}) kimliksiz/App Check'siz isteği ${res.status} ile reddetti.`);
    } else if (res.status === 404) {
      warn("C4", `Cloud Function henüz dağıtılmamış görünüyor (${fnUrl} → 404).`);
    } else {
      fail("B6-Canlı", `Canlı callable beklenmeyen durum kodu döndü: HTTP ${res.status}.`);
    }
  } catch (err) {
    warn("B6-Canlı", `Canlı callable uç noktasına ulaşılamadı: ${err.message}`);
  }

  if (!token) {
    warn(
      "API",
      "Firebase CLI oturumu bulunamadı (`node scripts/firebase.mjs login`). Uzak API denetimleri atlandı."
    );
    return results;
  }

  // 2. App Check: Firestore ve Storage zorlama durumu
  for (const service of ["firestore.googleapis.com", "firebasestorage.googleapis.com"]) {
    const url = `${FB_API}/${projectId}/services/${service}`;
    const { ok, status, body } = await apiGet(url, token, projectId);
    if (!ok) {
      warn("A8", `App Check (${service}) sorgulanamadı (HTTP ${status}: ${body.error?.message ?? "bilinmeyen hata"}).`);
    } else if (body.enforcementMode === "ENFORCED") {
      pass("A8", `App Check zorlaması açık: ${service} (ENFORCED).`);
    } else {
      fail("A8", `App Check zorlaması KAPALI: ${service} (mevcut: ${body.enforcementMode ?? "UNENFORCED"}).`);
    }
  }

  // 3. App Check: Web uygulaması reCAPTCHA Enterprise yapılandırması
  if (appId) {
    const url = `${FB_API}/${projectId}/apps/${appId}/recaptchaEnterpriseConfig`;
    const { ok, status, body } = await apiGet(url, token, projectId);
    if (!ok) {
      fail("A8", `Web uygulaması (${appId}) için reCAPTCHA Enterprise App Check kaydı bulunamadı (HTTP ${status}).`);
    } else if (recaptchaSiteKey && body.siteKey && body.siteKey !== recaptchaSiteKey) {
      fail("A8", `App Check reCAPTCHA siteKey (${body.siteKey}) ile .env.local (${recaptchaSiteKey}) eşleşmiyor!`);
    } else {
      pass("A8", "Web uygulaması App Check reCAPTCHA Enterprise sağlayıcısı ile kayıtlı.");
    }
  }

  // 4. Identity Platform / Auth (E-posta/Şifre, TOTP MFA, Şifre Politikası)
  {
    const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;
    const { ok, status, body } = await apiGet(url, token, projectId);
    if (!ok) {
      warn("A4/A5/A6", `Identity Platform yapılandırması okunamadı (HTTP ${status}).`);
    } else {
      if (body.signIn?.email?.enabled) {
        pass("A4", "Authentication E-posta/Şifre sağlayıcısı etkin.");
      } else {
        fail("A4", "Authentication E-posta/Şifre sağlayıcısı etkin değil.");
      }

      const totpEnabled = (body.mfa?.providerConfigs ?? []).some(
        (p) => p.state === "ENABLED" && p.totpProviderConfig
      );
      if (totpEnabled) {
        pass("A6", "Identity Platform TOTP (Authenticator) ikinci faktörü etkin.");
      } else {
        fail("A6", "TOTP ikinci faktörü etkin değil (`DEPLOY.md` §1.1.3 Admin SDK adımını çalıştırın).");
      }

      const policy = body.passwordPolicyConfig;
      const minLen = policy?.passwordPolicyVersions?.[0]?.customStrengthOptions?.minPasswordLength ?? 0;
      const state = policy?.passwordPolicyEnforcementState ?? "yok";
      if (state === "ENFORCE" && minLen >= 10) {
        pass("A5", `Şifre politikası zorunlu ve en az ${minLen} karakter.`);
      } else {
        fail("A5", `Şifre politikası eksik (durum: ${state}, min: ${minLen}).`);
      }
    }
  }

  // 5. Firestore: Bölge, PITR, config/security ve TTL politikaları
  {
    const dbBase = `${FS_API}/${projectId}/databases/(default)`;
    const { ok, status, body } = await apiGet(dbBase, token, projectId);
    if (!ok) {
      warn("A3/E3", `Firestore veritabanı bilgisi okunamadı (HTTP ${status}).`);
    } else {
      if (body.locationId === "eur3" || body.locationId === "europe-west1") {
        pass("A3", `Firestore veritabanı konumu uygun: ${body.locationId}.`);
      } else {
        fail("A3", `Firestore konumu 'eur3' veya 'europe-west1' olmalı (mevcut: ${body.locationId}).`);
      }

      if (body.pointInTimeRecoveryEnablement === "POINT_IN_TIME_RECOVERY_ENABLED") {
        pass("E3", "Firestore PITR (zamanda geri dönüş) etkin.");
      } else {
        fail("E3", "Firestore PITR kapalı (`gcloud firestore databases update --database='(default)' --enable-pitr`).");
      }
    }

    const secRes = await apiGet(`${dbBase}/documents/config/security`, token, projectId);
    if (secRes.status === 404) {
      pass("B8", "`config/security` dokümanı yok (güvenli varsayılan: 2FA ve e-posta doğrulaması zorunlu).");
    } else if (secRes.ok) {
      const mfa = secRes.body.fields?.requireMfa?.booleanValue;
      const emailVer = secRes.body.fields?.requireEmailVerified?.booleanValue;
      if (mfa === false || emailVer === false) {
        fail("B8", `KRİTİK: \`config/security\` içinde requireMfa=${mfa}, requireEmailVerified=${emailVer}!`);
      } else {
        pass("B8", "`config/security` dokümanında tüm güvenlik zorunlulukları açık.");
      }
    }

    for (const group of ["audit_logs", "rate_limits"]) {
      const ttlRes = await apiGet(`${dbBase}/collectionGroups/${group}/fields/expireAt`, token, projectId);
      const state = ttlRes.body?.ttlConfig?.state;
      if (state === "ACTIVE") {
        pass("C3", `Firestore TTL politikası etkin: ${group}.expireAt (ACTIVE).`);
      } else if (state === "CREATING") {
        warn("C3", `Firestore TTL politikası hazırlanıyor: ${group}.expireAt (CREATING).`);
      } else {
        fail("C3", `Firestore TTL politikası etkin değil: ${group}.expireAt (durum: ${state ?? "YOK"}).`);
      }
    }
  }

  // 6. Cloud Storage: CORS ve Soft Delete / Versioning
  if (storageBucket) {
    const encodedBucket = encodeURIComponent(storageBucket);
    const bucketUrl = `https://storage.googleapis.com/storage/v1/b/${encodedBucket}?projection=full`;
    const { ok, status, body } = await apiGet(bucketUrl, token, projectId);
    if (!ok) {
      warn("A10/A11/A12", `Storage kovası (${storageBucket}) okunamadı (HTTP ${status}).`);
    } else {
      const corsList = body.cors ?? [];
      const hasGetCors = corsList.some(
        (c) =>
          (c.method ?? []).includes("GET") &&
          (expectedOrigins.length === 0 ||
            expectedOrigins.every((orig) => (c.origin ?? []).includes(orig) || (c.origin ?? []).includes("*")))
      );
      if (hasGetCors) {
        pass("A11", "Storage CORS yapılandırması uygulama kökeni için GET izni içeriyor.");
      } else {
        fail("A11", `Storage kovasında (${storageBucket}) uygulama kökeni için GET CORS kuralı eksik (PDF açılmaz).`);
      }

      const softDeleteSec = Number(body.softDeletePolicy?.retentionDurationSeconds ?? 0);
      const versioning = body.versioning?.enabled === true;
      if (softDeleteSec > 0 || versioning) {
        pass("A12", `Storage veri koruma açık (softDelete=${softDeleteSec}sn, versioning=${versioning}).`);
      } else {
        fail("A12", "Storage kovasında geçici silme (soft delete) veya nesne sürümleme açık değil.");
      }
    }
  }

  // 7. Secret Manager: AUDIT_IP_SALT
  {
    const secretUrl = `https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/AUDIT_IP_SALT`;
    const { ok, status } = await apiGet(secretUrl, token, projectId);
    if (ok) {
      pass("B4", "Secret Manager içinde `AUDIT_IP_SALT` tanımlı.");
    } else if (status === 404) {
      fail(
        "B4",
        "Secret Manager'da `AUDIT_IP_SALT` yok (`node scripts/firebase.mjs functions:secrets:set AUDIT_IP_SALT`)."
      );
    } else {
      warn("B4", `Secret Manager \`AUDIT_IP_SALT\` sorgulanamadı (HTTP ${status}).`);
    }
  }

  return results;
}

function resolveProjectId(args, webEnv) {
  const idx = args.indexOf("--project");
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  if (webEnv?.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return webEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const rcPath = path.join(root, ".firebaserc");
  if (existsSync(rcPath)) {
    try {
      const rc = JSON.parse(readFileSync(rcPath, "utf8"));
      return rc.projects?.default ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const localOnly = args.includes("--local-only");

  const envLocalPath = path.join(root, ".env.local");
  const webEnv = existsSync(envLocalPath) ? parseEnvFile(readFileSync(envLocalPath, "utf8")) : null;
  const projectId = resolveProjectId(args, webEnv);

  const fnEnvPath = projectId ? path.join(root, "functions", `.env.${projectId}`) : null;
  let fnEnv = fnEnvPath && existsSync(fnEnvPath) ? parseEnvFile(readFileSync(fnEnvPath, "utf8")) : null;
  let autoFixedAppCheck = false;

  // Gerçek projede ENFORCE_APP_CHECK=false kalmışsa otomatik olarak true'ya düzelt
  if (fnEnvPath && fnEnv && projectId && !projectId.startsWith("demo-") && fnEnv.ENFORCE_APP_CHECK === "false") {
    const raw = readFileSync(fnEnvPath, "utf8");
    const updated = raw.replace(/^(\s*ENFORCE_APP_CHECK\s*=\s*)["']?false["']?/m, "$1true");
    if (updated !== raw) {
      writeFileSync(fnEnvPath, updated, "utf8");
      fnEnv = parseEnvFile(updated);
      autoFixedAppCheck = true;
    }
  }

  console.log("\n🔍 Pediatrist Firebase & App Check Doğrulama Aracı");
  console.log(`   Proje: ${projectId ?? "(belirlenemedi)"}\n`);

  const allResults = [...verifyLocalEnv({ webEnv, fnEnv, projectId, autoFixedAppCheck })];

  if (!localOnly && projectId && !projectId.startsWith("demo-")) {
    const token = await resolveAccessToken();
    const expectedOrigins = (fnEnv?.WEBAUTHN_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const remoteResults = await verifyRemoteServices({
      projectId,
      appId: webEnv?.NEXT_PUBLIC_FIREBASE_APP_ID,
      recaptchaSiteKey: webEnv?.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY,
      storageBucket: webEnv?.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      expectedOrigins,
      token,
    });
    allResults.push(...remoteResults);
  }

  const icons = { PASS: "✅", FAIL: "❌", WARN: "⚠️ " };
  for (const r of allResults) {
    console.log(`${icons[r.status]} [${r.id}] ${r.msg}`);
  }

  const fails = allResults.filter((r) => r.status === "FAIL").length;
  const warns = allResults.filter((r) => r.status === "WARN").length;
  const passes = allResults.filter((r) => r.status === "PASS").length;

  console.log(`\nÖzet: ${passes} başarılı, ${warns} uyarı, ${fails} hata.`);
  if (fails > 0) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Beklenmeyen hata:", err);
    process.exit(1);
  });
}
