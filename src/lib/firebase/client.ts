import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFunctions, Functions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, AppCheck } from "firebase/app-check";

/**
 * Firebase Web SDK yapılandırması YALNIZCA ortam değişkenlerinden okunur.
 *
 * GÜVENLİK NOTLARI:
 * - Kaynak kodda hiçbir proje kimliği / API anahtarı sabit (hardcoded) olarak tutulmaz.
 *   Gerçek değerler git'e girmeyen `.env.local` dosyasındadır (bkz. `.env.example`).
 * - Bu modül yapılandırma nesnesini DIŞA AKTARMAZ; hiçbir UI bileşeni proje kimliği,
 *   auth domain veya bucket adını ekrana basamaz. UI yalnızca `isFirebaseConfigured()`
 *   ile "bağlı / bağlı değil" bilgisini gösterebilir.
 * - Web API anahtarı tarayıcı paketine zorunlu olarak girer; asıl koruma
 *   Google Cloud Console'da HTTP referrer kısıtlaması + App Check + Firestore/Storage
 *   kuralları + Cloud Functions içindeki rol kontrolleridir.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
};

const reCaptchaEnterpriseSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY ?? "";
const FUNCTIONS_REGION = "europe-west1";

let firebaseApp: FirebaseApp | null = null;
let firebaseAppCheck: AppCheck | null = null;

/** UI için tek izinli bilgi: yapılandırma mevcut mu? (kimlik bilgisi döndürmez) */
export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

export interface PediatristFirebaseClients {
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  functions: Functions;
}

/**
 * Firebase İstemci SDK'sını (Auth, Firestore, Storage, Functions ve App Check) başlatır.
 * Yapılandırma eksikse `null` döner (hata mesajında da hiçbir değer basılmaz).
 */
export function initPediatristFirebase(): PediatristFirebaseClients | null {
  if (!isFirebaseConfigured()) {
    return null;
  }

  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

  if (typeof window !== "undefined" && reCaptchaEnterpriseSiteKey && !firebaseAppCheck) {
    firebaseAppCheck = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(reCaptchaEnterpriseSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  return {
    auth: getAuth(firebaseApp),
    db: getFirestore(firebaseApp),
    storage: getStorage(firebaseApp),
    functions: getFunctions(firebaseApp, FUNCTIONS_REGION),
  };
}
