import React from "react";
import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "@/styles/tokens.css";
import "@/styles/index.css";
import "@/styles/ui.css";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * Yazı tipleri derleme sırasında indirilir ve uygulamanın kendi sunucusundan verilir (F3.1):
 * çalışma zamanında Google'a istek yok (gizlilik/KVKK, CSP), render engelleyen `@import` yok.
 * `latin-ext` alt kümesi Türkçe karakterler (ğ, ş, ı, İ) içindir.
 */
const sans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-jakarta",
});

const mono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Pediatrist — Pediatri Eğitim Kliniği Platformu",
  description: "Pediatri Eğitim Kliniği Yönetim ve Eğitim Platformu",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b6cad",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
