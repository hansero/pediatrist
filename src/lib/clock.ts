/**
 * Cihaz saati ile sunucu saati arasındaki fark (F13.2). Sınav ekranı (F5.3) ve projektör (F13.2) aynı yöntemi
 * kullanır: sunucunun yanıtta bildirdiği an, isteğin gidiş-dönüş ortasındaki cihaz saatiyle karşılaştırılır.
 *
 * Dönüş: sunucu saati − cihaz saati (ms). Sunucudaki "şimdi" ≈ `Date.now() + fark`.
 */
export function clockOffsetMs(serverNowMs: number, sentAtMs: number, receivedAtMs: number): number {
  return serverNowMs - Math.round((sentAtMs + receivedAtMs) / 2);
}

/** Sunucu saatini döndüren bir isteği çalıştırır ve yanıtla birlikte saat farkını verir. */
export async function withClockOffset<T extends { serverNowMs: number }>(
  request: () => Promise<T>,
  now: () => number = Date.now
): Promise<{ result: T; offsetMs: number }> {
  const sentAt = now();
  const result = await request();
  return { result, offsetMs: clockOffsetMs(result.serverNowMs, sentAt, now()) };
}
