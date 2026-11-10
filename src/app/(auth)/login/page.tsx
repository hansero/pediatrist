"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { SIGN_OUT_MESSAGES, type SignOutReason } from "@/lib/auth/sessionDecision";
import { signInWithEmailAndPassword } from "firebase/auth";
import { initPediatristFirebase } from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");

  // Oturum bağlamı askıya alma / oturum iptalinde buraya `?neden=...` ile yönlendirir (F2.4).
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("neden") as SignOutReason | null;
    if (reason && reason in SIGN_OUT_MESSAGES) setNotice(SIGN_OUT_MESSAGES[reason]);
  }, []);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSubmitting(true);

    try {
      const clients = initPediatristFirebase();
      if (clients) {
        await signInWithEmailAndPassword(clients.auth, email.trim(), password);
      }
      setStep("mfa");
    } catch {
      setErrorMessage("Kurumsal e-posta adresi veya şifre doğrulanamadı. Lütfen bilgilerinizi kontrol edin.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMfaVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.trim().length !== 6) {
      setErrorMessage("Lütfen 6 haneli doğrulama kodunu eksiksiz girin.");
      return;
    }
    window.location.href = "/dashboard";
  };

  return (
    <main className="auth-screen">
      <article className="auth-card" aria-labelledby="login-page-heading">
        <div className="brand-header" style={{ borderBottomColor: "var(--border-subtle)" }}>
          <div className="brand-mark">P</div>
          <div>
            <h1 id="login-page-heading" style={{ fontSize: "1.2rem" }}>
              Pediatri Eğitim Kliniği Girişi
            </h1>
            <span className="page-header-subtitle" style={{ fontSize: "0.78rem" }}>
              Kapalı Devre Hekim Oturumu &amp; İki Aşamalı Doğrulama
            </span>
          </div>
        </div>

        {notice && (
          <div role="status" className="clinical-alert warning" style={{ marginBottom: "1rem" }}>
            {notice}
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="clinical-alert critical" style={{ marginBottom: "1rem" }}>
            {errorMessage}
          </div>
        )}

        {step === "credentials" ? (
          <form id="auth-credentials-form" onSubmit={handleCredentialsSubmit}>
            <div className="form-group">
              <label htmlFor="login-email-input" className="form-label">
                Kurumsal Hekim E-Postası
              </label>
              <input
                id="login-email-input"
                type="email"
                className="form-input"
                placeholder="ad.soyad@pediatri.edu.tr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password-input" className="form-label">
                Klinik Oturum Şifresi
              </label>
              <input
                id="login-password-input"
                type="password"
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              id="login-continue-mfa-btn"
              type="submit"
              style={{ width: "100%" }}
              loading={submitting}
              loadingText="Bilgiler Doğrulanıyor…"
            >
              İki Aşamalı Doğrulamaya Geç
            </Button>

            <div style={{ marginTop: "1rem", textAlign: "center", fontSize: "0.82rem" }}>
              <Link
                id="login-to-register-link"
                href="/register"
                style={{ color: "var(--clinical-primary)", fontWeight: 600 }}
              >
                Kliniğe yeni başladınız mı? Asistan / Uzman Üyelik Başvurusu Yapın &rarr;
              </Link>
            </div>
          </form>
        ) : (
          <form id="auth-mfa-form" onSubmit={handleMfaVerify}>
            <div className="form-group">
              <label htmlFor="login-totp-input" className="form-label">
                6 Haneli Doğrulama Kodu (Authenticator)
              </label>
              <input
                id="login-totp-input"
                type="text"
                maxLength={6}
                className="form-input mono-num"
                style={{ fontSize: "1.25rem", letterSpacing: "0.2em", textAlign: "center" }}
                placeholder="123456"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button
                id="login-back-credentials-btn"
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep("credentials")}
              >
                Geri
              </button>
              <button id="login-verify-totp-btn" type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                Doğrula ve Kliniğe Giriş Yap
              </button>
            </div>
          </form>
        )}
      </article>
    </main>
  );
}
