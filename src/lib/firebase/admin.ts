import "server-only";
import * as admin from "firebase-admin";

/**
 * Sunucu tarafı (Server Actions / API Routes) için Firebase Admin SDK başlatıcısı.
 *
 * GÜVENLİK: Proje kimliği ve servis hesabı bilgileri yalnızca sunucu ortam
 * değişkenlerinden okunur (NEXT_PUBLIC_ öneki YOKTUR → tarayıcı paketine girmez).
 * Kaynak kodda varsayılan proje kimliği bulunmaz. `server-only` importu bu modülün
 * yanlışlıkla bir istemci bileşenine dahil edilmesini derleme anında engeller.
 */
export function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

    if (!projectId) {
      throw new Error("Sunucu yapılandırması eksik (FIREBASE_PROJECT_ID).");
    }

    admin.initializeApp(
      clientEmail && privateKey
        ? { credential: admin.credential.cert({ projectId, clientEmail, privateKey }), storageBucket }
        : { projectId, storageBucket } // Application Default Credentials (Cloud Run / Functions)
    );
  }

  return {
    adminAuth: admin.auth(),
    adminDb: admin.firestore(),
    adminStorage: admin.storage(),
  };
}
