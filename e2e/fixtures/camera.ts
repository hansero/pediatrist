import type { BrowserContext, Page } from "@playwright/test";
import QRCode from "qrcode";

/**
 * Sahte kamera (F11.2, YALNIZCA e2e): `getUserMedia` bir canvas akışına bağlanır; test bu canvas'a istediği QR'ı
 * çizer. Uygulamanın okuyucusu (görüntü → `jsqr` → bağlantı çözümü → gönderim) gerçek haliyle çalışır; yalnızca
 * kamera donanımı yerine canvas vardır. Canvas sürekli yeniden çizilir ki akış kare üretmeye devam etsin.
 */
export async function installFakeCamera(context: BrowserContext) {
  await context.addInitScript(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext("2d")!;
    let image: HTMLImageElement | null = null;
    const paint = () => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (image) ctx.drawImage(image, 40, 40, 400, 400);
    };
    paint();
    window.setInterval(paint, 100);
    const w = window as unknown as {
      __showOnCamera: (dataUrl: string) => Promise<void>;
      __cameraRequests: number;
    };
    w.__cameraRequests = 0;
    w.__showOnCamera = (dataUrl: string) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          image = img;
          paint();
          resolve();
        };
        img.src = dataUrl;
      });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        w.__cameraRequests += 1;
        return canvas.captureStream(15);
      },
    });
  });
}

/** Kameranın önüne verilen metni QR olarak tutar. */
export async function showQrOnCamera(page: Page, text: string) {
  const dataUrl = await QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 2, width: 400 });
  await page.evaluate(
    (url) => (window as unknown as { __showOnCamera: (u: string) => Promise<void> }).__showOnCamera(url),
    dataUrl
  );
}

/** Uygulamanın kamerayı kaç kez istediği (izin isteği yalnızca düğmeyle gelmeli). */
export const cameraRequests = (page: Page) =>
  page.evaluate(() => (window as unknown as { __cameraRequests: number }).__cameraRequests);

/** Kullanıcının kamera iznini reddettiği durum: tarayıcı `getUserMedia`'yı `NotAllowedError` ile reddeder. */
export async function denyCamera(context: BrowserContext) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        throw new DOMException("Permission denied", "NotAllowedError");
      },
    });
  });
}
