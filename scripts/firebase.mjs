#!/usr/bin/env node
/**
 * Firebase CLI sarmalayıcısı.
 *
 * 1) `firebase.json` → `hosting.source` (Next.js webframeworks) deneysel özellik gerektirir;
 *    etkin değilse CLI (emülatörler dahil) çalışmayı reddeder. Ortam değişkenini npm
 *    script'ine gömmek Windows'ta çalışmadığı için bu sarmalayıcı kullanılır.
 *
 * 2) Proxy arkasındaki ortamlar (kurum ağı, bulut sandbox): firebase-tools `HTTPS_PROXY`'yi
 *    NO_PROXY'ye bakmadan TÜM isteklere uygular (lib/apiv2.js → proxyURIFromEnv). Bu yüzden
 *    emülatörler arası yerel çağrılar (ör. Firestore tetikleyicisi kaydı → 127.0.0.1:8080)
 *    proxy'ye gidip reddedilir. Emülatörler tamamen yerel çalıştığından:
 *      a) gereken emülatör jar'ları önce proxy AÇIKKEN indirilir (önbellekteyse anında geçer),
 *      b) emülatör komutu proxy değişkenleri temizlenmiş olarak çalıştırılır.
 *
 * Kullanım: node scripts/firebase.mjs <firebase argümanları>
 */
import { spawnSync, spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const cli = require.resolve("firebase-tools/lib/bin/firebase.js");
const args = process.argv.slice(2);

const experiments = new Set((process.env.FIREBASE_CLI_EXPERIMENTS ?? "").split(",").filter(Boolean));
experiments.add("webframeworks");
const baseEnv = { ...process.env, FIREBASE_CLI_EXPERIMENTS: [...experiments].join(",") };

const PROXY_VARS = ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"];
const isEmulatorCommand = args[0]?.startsWith("emulators:");
const hasProxy = PROXY_VARS.some((v) => process.env[v]);

let env = baseEnv;
if (isEmulatorCommand && hasProxy) {
  for (const target of ["firestore", "storage", "ui"]) {
    const r = spawnSync(process.execPath, [cli, `setup:emulators:${target}`], { stdio: "inherit", env: baseEnv });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
  env = { ...baseEnv };
  for (const v of PROXY_VARS) delete env[v];
}

const child = spawn(process.execPath, [cli, ...args], { stdio: "inherit", env });
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
