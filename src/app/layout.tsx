import type { Metadata } from "next";
import "@/styles/index.css";

export const metadata: Metadata = {
  title: "Pediatrist — Pediatri Eğitim Kliniği Platformu",
  description: "Pediatri Eğitim Kliniği Yönetim ve Eğitim Platformu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
