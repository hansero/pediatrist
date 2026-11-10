"use client";

import Link from "next/link";
import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { AppError } from "@/lib/errors";
import { initPediatristFirebase } from "@/lib/firebase/client";

/**
 * Şifre sıfırlama isteği (F3.4). Bağlantı Firebase tarafından gönderilir; yeni şifre Firebase'in
 * güvenli sayfasında belirlenir.
 *
 * Hesap varlığı sızdırılmaz: kayıtlı olmayan adres için de aynı (nötr) mesaj gösterilir.
 * Geçersiz adres, çok fazla deneme ve bağlantı hataları ise gerçekten gösterilir.
 */
export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const request = useAsyncAction(async () => {
    const auth = initPediatristFirebase()?.auth;
    if (!auth) throw new AppError("not-configured", "Sunucu bağlantısı yapılandırılmamış.");
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      if ((err as { code?: unknown }).code !== "auth/user-not-found") throw err;
    }
    return true as const;
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await request.run();
  }

  return (
    <main className="auth-screen">
      <article className="auth-card" aria-labelledby="reset-heading">
        <div className="brand-header auth-brand">
          <div className="brand-mark" aria-hidden="true">
            P
          </div>
          <div>
            <h1 id="reset-heading" className="auth-title">
              Şifre sıfırlama
            </h1>
            <span className="page-header-subtitle">Pediatri Eğitim Kliniği Platformu</span>
          </div>
        </div>

        <div className="auth-stack">
          {request.data ? (
            <Alert tone="success" title="E-postanızı kontrol edin">
              Bu adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Bağlantı bir süre sonra geçersiz olur.
            </Alert>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <p className="page-header-subtitle auth-hint">
                Hesabınızın e-posta adresini girin; şifrenizi yenilemeniz için bir bağlantı gönderelim.
              </p>
              {request.error && <Alert tone="critical">{request.error}</Alert>}
              <Field label="E-posta" required>
                {(p) => (
                  <input
                    {...p}
                    type="email"
                    className="form-input"
                    autoComplete="username"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                )}
              </Field>
              <Button type="submit" className="btn-block" loading={request.pending} loadingText="Gönderiliyor…">
                Sıfırlama bağlantısı gönder
              </Button>
            </form>
          )}
          <div className="auth-links">
            <Link href="/login">Girişe dön</Link>
          </div>
        </div>
      </article>
    </main>
  );
}
