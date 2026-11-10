/**
 * Tam sayfa geçişi (geçmişe kayıt bırakmadan). Girişten sonra kullanılır: odak ve okunma sırası
 * sayfanın başından başlar (istemci tarafı geçişte klavye odağı eski formun konumunda kalıyordu; F3.4 e2e),
 * giriş formunun durumu bellekte kalmaz. Testlerde sahte yerine konabilsin diye ayrı modül.
 */
export function hardNavigate(path: string): void {
  window.location.replace(path);
}
