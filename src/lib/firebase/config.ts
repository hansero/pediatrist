/**
 * Firebase Web yapılandırması (F7.5): YALNIZCA ortam değişkenlerinden okunur ve SDK içermez, böylece sunucu
 * bileşenleri (kök yerleşim) de yapılandırmanın varlığını denetleyebilir. Değerler hiçbir ekrana basılmaz;
 * eksik olduğunda yalnızca eksik DEĞİŞKEN ADLARI gösterilir (adlar gizli değildir).
 *
 * Not: Next.js `NEXT_PUBLIC_*` değerlerini yalnızca `process.env.NEXT_PUBLIC_X` biçimindeki doğrudan erişimde
 * pakete gömer; bu yüzden her değişken ayrı ve açık yazılır.
 */
export const firebaseWebConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

/** Uygulamanın çalışması için zorunlu değişkenler (Auth, Firestore, Storage, Functions). */
const REQUIRED: [keyof typeof firebaseWebConfig, string][] = [
  ["apiKey", "NEXT_PUBLIC_FIREBASE_API_KEY"],
  ["authDomain", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"],
  ["projectId", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"],
  ["storageBucket", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"],
  ["appId", "NEXT_PUBLIC_FIREBASE_APP_ID"],
];

/** Eksik zorunlu değişkenlerin ADLARI (değer değil). */
export function missingFirebaseConfig(config = firebaseWebConfig): string[] {
  return REQUIRED.filter(([key]) => !config[key].trim()).map(([, name]) => name);
}

export function isFirebaseConfigured(config = firebaseWebConfig): boolean {
  return missingFirebaseConfig(config).length === 0;
}
