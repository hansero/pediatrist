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

if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });
