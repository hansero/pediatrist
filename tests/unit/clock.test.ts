import { describe, expect, it } from "vitest";
import { clockOffsetMs, withClockOffset } from "@/lib/clock";

describe("saat farkı (F13.2)", () => {
  it("sunucu saati − gidiş-dönüş ortasındaki cihaz saati", () => {
    // Cihaz 1000'de gönderdi, 1200'de aldı (orta 1100); sunucu 4100 dedi → cihaz 3 sn geride.
    expect(clockOffsetMs(4_100, 1_000, 1_200)).toBe(3_000);
    // Cihaz saati ileri (ör. kaymış projektör bilgisayarı): fark negatif.
    expect(clockOffsetMs(1_100, 181_000, 181_200)).toBe(-180_000);
  });

  it("withClockOffset isteği çalıştırır; yanıtı ve farkı döndürür", async () => {
    const times = [10_000, 10_400];
    const { result, offsetMs } = await withClockOffset(
      async () => ({ serverNowMs: 5_200, code: "ABC" }),
      () => times.shift()!
    );
    expect(result.code).toBe("ABC");
    expect(offsetMs).toBe(5_200 - 10_200);
  });
});
