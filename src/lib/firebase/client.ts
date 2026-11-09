import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, Firestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage, FirebaseStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions, Functions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import firebaseJson from "../../../firebase.json";

/**
 * Firebase Web SDK yapılandırması YALNIZCA ortam değişkenlerinden okunur.
 *
 * GÜVENLİK NOTLARI:
 * - Kaynak kodda hiçbir proje kimliği / API anahtarı sabit (hardcoded) olarak tutulmaz.
 *   Yerel geliştirme değerleri `.env.development` (yalnızca emülatör, gizli değer yok),
 *   gerçek proje değerleri git'e girmeyen `.env.local` dosyasındadır (bkz. `.env.example`).
 * - Bu modül yapılandırma nesnesini DIŞA AKTARMAZ.
 * - Web API anahtarı tarayıcı paketine zorunlu olarak girer; asıl koruma
 *   HTTP referrer kısıtlaması + App Check + Firestore/Storage kuralları + Cloud Functions
 *   içindeki yetki kontrolleridir.
 *
 * EMÜLATÖR MODU (`NEXT_PUBLIC_USE_EMULATORS=true`):
 * - Yalnızca `demo-` önekli proje kimliğiyle çalışır (D18). Böylece emülatör modu
 *   yanlışlıkla gerçek bir projenin yapılandırmasıyla birleştirilemez.
 * - Portlar tek kaynaktan, `firebase.json` → `emulators` bölümünden okunur.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

const USE_EMULATORS = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";
const RECAPTCHA_ENTERPRISE_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY ?? "";
/** Yalnızca localhost'tan gerçek (staging) projeye bağlanırken kullanılır; konsolda kayıtlı debug token. */
const APPCHECK_DEBUG_TOKEN = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN ?? "";
const FUNCTIONS_REGION = "europe-west1";

export interface PediatristFirebaseClients {
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  functions: Functions;
}

let clients: PediatristFirebaseClients | null = null;

/** UI için tek izinli bilgi: yapılandırma mevcut mu? (kimlik bilgisi döndürmez) */
export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

/** Emülatör modunda mıyız? (UI'da "Test ortamı" göstergesi için) */
export function isUsingEmulators(): boolean {
  return USE_EMULATORS;
}

function connectEmulators(c: PediatristFirebaseClients) {
  if (!firebaseConfig.projectId.startsWith("demo-")) {
    throw new Error(
      "Emülatör modu yalnızca 'demo-' önekli proje kimliğiyle çalışır. NEXT_PUBLIC_FIREBASE_PROJECT_ID değerini kontrol edin."
    );
  }
  const e = firebaseJson.emulators;
  connectAuthEmulator(c.auth, `http://${e.auth.host}:${e.auth.port}`, { disableWarnings: true });
  connectFirestoreEmulator(c.db, e.firestore.host, e.firestore.port);
  connectStorageEmulator(c.storage, e.storage.host, e.storage.port);
  connectFunctionsEmulator(c.functions, e.functions.host, e.functions.port);
}

function initAppCheck(app: FirebaseApp) {
  // Emülatörler App Check doğrulaması yapmaz; functions tarafında zorunluluk
  // ENFORCE_APP_CHECK=false ile kapalıdır (functions/.env.demo-pediatrist).
  if (USE_EMULATORS || typeof window === "undefined" || !RECAPTCHA_ENTERPRISE_SITE_KEY) return;
  if (APPCHECK_DEBUG_TOKEN) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      APPCHECK_DEBUG_TOKEN;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

/**
 * Firebase İstemci SDK'sını (Auth, Firestore, Storage, Functions ve App Check) bir kez başlatır
 * ve aynı nesneyi döndürür. Yapılandırma eksikse `null` döner (hata mesajında hiçbir değer basılmaz).
 */
export function initPediatristFirebase(): PediatristFirebaseClients | null {
  if (clients) return clients;
  if (!isFirebaseConfigured()) return null;

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const created: PediatristFirebaseClients = {
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
    functions: getFunctions(app, FUNCTIONS_REGION),
  };

  if (USE_EMULATORS) connectEmulators(created);
  initAppCheck(app);

  clients = created;
  return clients;
}
