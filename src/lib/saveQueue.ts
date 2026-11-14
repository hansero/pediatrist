/**
 * Kayıt sırası (F5.3; F13.4'te ortak modül): aynı anda tek istek; gönderim sürerken gelen değişiklik bir sonraki turda gönderilir
 * (yalnızca en son değer; eski yanıt yenisinin üzerine yazılamaz). Döngüden çıkış ile `running = false` aynı
 * eşzamanlı adımda olur: arada gelen değer kaybolmaz. Gönderilemeyen değer bekletilir; sonraki `push`/`flush`
 * en güncel değeri yeniden dener. Saf mantık; birim testli.
 */
export function createSaveQueue<T>(send: (value: T) => Promise<void>) {
  let latest: T | undefined;
  let hasPending = false;
  let running: Promise<void> | null = null;

  function start(): Promise<void> {
    if (running) return running;
    running = (async () => {
      try {
        while (hasPending) {
          hasPending = false;
          const value = latest as T;
          try {
            await send(value);
          } catch (err) {
            // Daha yeni bir değer gelmediyse bu değer yeniden denenecek.
            hasPending = true;
            throw err;
          }
        }
      } finally {
        running = null;
      }
    })();
    return running;
  }

  return {
    /** En son değeri sıraya koyar ve gönderimi başlatır; bu değer gönderilince (veya hata olunca) çözülür. */
    push(value: T): Promise<void> {
      latest = value;
      hasPending = true;
      return start();
    },
    /** Bekleyen (ör. başarısız olmuş) değeri yeniden gönderir; bekleyen yoksa çalışan gönderimi bekler. */
    flush(): Promise<void> {
      return hasPending ? start() : (running ?? Promise.resolve());
    },
    get pending() {
      return hasPending || running !== null;
    },
  };
}
