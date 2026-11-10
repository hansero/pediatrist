/**
 * Functions testleri için ortak kurulum. Testler Firestore ve Auth emülatörlerine bağlanır
 * (`npm run test:functions` bunları `emulators:exec` ile başlatır ve ortam değişkenlerini ayarlar).
 */
import { getApps, initializeApp } from "firebase-admin/app";

export const PROJECT_ID = "demo-pediatrist";

for (const key of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"]) {
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
// `config/security` dokümanıdır (N8); `helpers.ts → resetEmulators/setSecurityConfig`.
process.env.ENFORCE_APP_CHECK = "false";
process.env.REQUIRE_EMAIL_VERIFIED = "false";

if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });
