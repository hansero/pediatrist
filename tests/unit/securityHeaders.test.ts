import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REGION } from "@shared/constants";
import { buildCspDirectives, buildSecurityHeaders, functionsOrigin, serializeCsp } from "../../config/securityHeaders";

/** F2.5 (AUDIT C6): CSP ve güvenlik başlıklarının tek kaynağı ve üretim değerleri. */
const root = path.resolve(import.meta.dirname, "..", "..");
const firebaseJson = JSON.parse(readFileSync(path.join(root, "firebase.json"), "utf8"));

const prod = buildCspDirectives({ isDev: false, useEmulators: false, projectId: "pediatrist-prod" });

describe("üretim CSP'si", () => {
  it("callable istekleri yalnızca bu projenin bölgesel uç noktasına gider", () => {
    expect(prod["connect-src"]).toContain(`https://${REGION}-pediatrist-prod.cloudfunctions.net`);
    expect(prod["connect-src"]).not.toContain("https://*.cloudfunctions.net");
  });

  it("App Check (reCAPTCHA Enterprise) çalışabilir: betik, çerçeve ve token takası", () => {
    expect(prod["script-src"]).toEqual(
      expect.arrayContaining(["https://www.google.com/recaptcha/", "https://www.gstatic.com/recaptcha/"])
    );
    expect(prod["frame-src"]).toEqual(
      expect.arrayContaining(["https://www.google.com/recaptcha/", "https://recaptcha.google.com/recaptcha/"])
    );
    expect(prod["connect-src"]).toContain("https://content-firebaseappcheck.googleapis.com");
  });

  it("Auth, Firestore ve Storage uç noktaları açık; Storage medyası (görsel, video, PDF) yüklenebilir", () => {
    for (const host of [
      "https://identitytoolkit.googleapis.com",
      "https://securetoken.googleapis.com",
      "https://firestore.googleapis.com",
      "https://firebasestorage.googleapis.com",
    ]) {
      expect(prod["connect-src"], host).toContain(host);
    }
    expect(prod["img-src"]).toContain("https://firebasestorage.googleapis.com");
    expect(prod["media-src"]).toEqual(["'self'", "blob:", "https://firebasestorage.googleapis.com"]);
    expect(prod["worker-src"]).toEqual(["'self'", "blob:"]);
  });

  it("geliştirme ve emülatör istisnaları üretimde yok; geniş jokerler yok", () => {
    const all = Object.values(prod).flat();
    expect(all).not.toContain("'unsafe-eval'");
    expect(all.some((s) => /localhost|127\.0\.0\.1/.test(s))).toBe(false);
    expect(all).not.toContain("https://*.googleapis.com");
    expect(all.some((s) => s.includes("firebaseio.com"))).toBe(false);
    expect(all).not.toContain("https://apis.google.com");
    expect(all).not.toContain("*");
  });

  it("sertleştirme direktifleri mevcut", () => {
    expect(prod["object-src"]).toEqual(["'none'"]);
    expect(prod["base-uri"]).toEqual(["'self'"]);
    expect(prod["form-action"]).toEqual(["'self'"]);
    expect(prod["frame-ancestors"]).toEqual(["'none'"]);
    expect(prod["default-src"]).toEqual(["'self'"]);
  });
});

describe("geliştirme / emülatör CSP'si", () => {
  it("next dev 'unsafe-eval' alır, emülatör modu yerel adresleri alır", () => {
    const dev = buildCspDirectives({ isDev: true, useEmulators: true, projectId: "demo-pediatrist" });
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toEqual(expect.arrayContaining(["http://127.0.0.1:*", "ws://127.0.0.1:*"]));
    expect(dev["img-src"]).toContain("http://127.0.0.1:*");
    expect(dev["media-src"]).toContain("http://127.0.0.1:*");
  });

  it("e2e (üretim derlemesi + emülatör) 'unsafe-eval' almaz", () => {
    const e2e = buildCspDirectives({ isDev: false, useEmulators: true, projectId: "demo-pediatrist" });
    expect(e2e["script-src"]).not.toContain("'unsafe-eval'");
  });
});

describe("yardımcılar", () => {
  it("proje kimliği yoksa veya geçersizse bölge-bağımsız joker kullanılır", () => {
    expect(functionsOrigin(undefined)).toBe("https://*.cloudfunctions.net");
    expect(functionsOrigin("")).toBe("https://*.cloudfunctions.net");
    expect(functionsOrigin("kötü; script-src *")).toBe("https://*.cloudfunctions.net");
  });

  it("serileştirme direktif başına tek satır üretir; boş kaynaklı direktif tek kelime kalır", () => {
    expect(serializeCsp({ "default-src": ["'self'"], "block-all-mixed-content": [] })).toBe(
      "default-src 'self'; block-all-mixed-content"
    );
  });

  it("başlık listesi CSP'yi ve temel güvenlik başlıklarını içerir", () => {
    const keys = buildSecurityHeaders({ isDev: false, useEmulators: false }).map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "Cross-Origin-Opener-Policy",
      ])
    );
  });
});

describe("firebase.json ↔ tek kaynak", () => {
  it("Hosting'de başlık kopyası yok (tek kaynak next.config.ts → config/securityHeaders.ts)", () => {
    expect(firebaseJson.hosting.headers).toBeUndefined();
  });

  it("SSR backend'i ortak REGION sabitiyle aynı bölgede (KVKK veri yerleşimi, gecikme)", () => {
    expect(firebaseJson.hosting.frameworksBackend?.region).toBe(REGION);
  });
});
