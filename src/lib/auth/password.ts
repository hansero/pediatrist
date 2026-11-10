/**
 * Kayıt formundaki şifre ön kontrolü (F3.5). Kullanıcıya erken ve Türkçe geri bildirim içindir;
 * asıl şifre politikası Identity Platform'da uygulanır (staging: en az 10 karakter, karışık; F10.2).
 */
export const PASSWORD_MIN_LENGTH = 8;

export function passwordProblem(password: string): string {
  if (password.length < PASSWORD_MIN_LENGTH) return `Şifre en az ${PASSWORD_MIN_LENGTH} karakter olmalı.`;
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(password) || !/\d/.test(password)) return "Şifre harf ve rakam içermeli.";
  return "";
}
