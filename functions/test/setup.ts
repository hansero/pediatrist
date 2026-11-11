/**
 * Functions testleri için ortak kurulum. Testler Firestore, Auth ve Storage emülatörlerine bağlanır
 * (`npm run test:functions` bunları `emulators:exec` ile başlatır ve ortam değişkenlerini ayarlar).
 */
import { getApps, initializeApp } from "firebase-admin/app";

export const PROJECT_ID = "demo-pediatrist";

for (const key of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]) {
  if (!process.env[key]) {
    throw new Error(`${key} tanımlı değil. Functions testleri yalnızca 'npm run test:functions' ile çalışır.`);
  }
}
if (!(process.env.GCLOUD_PROJECT ?? PROJECT_ID).startsWith("demo-")) {
  throw new Error("Functions testleri yalnızca 'demo-' önekli projede çalışır.");
}
process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.METADATA_SERVER_DETECTION = "none";

// Testler emülatör çalışma ortamında değil vitest sürecinde koşar; `.env.demo-pediatrist` yüklenmez.
// guards.ts güvenli varsayılan kullandığı için (değişken yoksa zorunluluk AÇIK) burada kapatılır;
// koruyucu testleri bunları tek tek açar (`withEnforced`). MFA zorunluluğu parametre değil,
// MFA ve e-posta doğrulama zorunlulukları `config/security` dokümanıdır (N8, D21); `helpers.ts → setSecurityConfig`.
process.env.ENFORCE_APP_CHECK = "false";

// WebAuthn RP (F4.2): emülatör .env'iyle aynı değerler; yazılım doğrulayıcı bu kökeni kullanır.
process.env.WEBAUTHN_RP_ID = "localhost";
process.env.WEBAUTHN_ORIGINS = "http://localhost:3100,http://localhost:3000";

// Varsayılan bucket: emülatör çalışma ortamındaki FIREBASE_CONFIG ile aynı (sınav görseli varlık kontrolü, F5.1).
if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID, storageBucket: `${PROJECT_ID}.appspot.com` });
