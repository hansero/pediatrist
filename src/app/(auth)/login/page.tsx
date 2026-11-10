"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { signInWithEmailAndPassword, type MultiFactorResolver } from "firebase/auth";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { completeTotpSignIn, mfaResolverFrom, totpHint } from "@/lib/auth/mfa";
import { SIGN_OUT_MESSAGES, SIGN_OUT_TONES, type SignOutReason } from "@/lib/auth/sessionDecision";
import { AppError } from "@/lib/errors";
import { initPediatristFirebase } from "@/lib/firebase/client";
import { hardNavigate } from "@/lib/navigation";

/** İkinci adım oturumu geçersizleştiğinde (≈5 dk) baştan giriş gerekir. */
const EXPIRED_MFA_SESSION = new Set(["auth/invalid-multi-factor-session", "auth/missing-multi-factor-session"]);

function clientsOrThrow() {
  const clients = initPediatristFirebase();
  if (!clients) throw new AppError("not-configured", "Sunucu bağlantısı yapılandırılmamış.");
  return clients;
}

/**
 * Giriş (F3.4, AUDIT C4).
 * 1) E-posta + şifre. Hesapta Authenticator kayıtlıysa Firebase `auth/multi-factor-auth-required` döner.
 * 2) Authenticator kodu `resolver.resolveSignIn` ile doğrulanır. Kod istemcide DEĞİL, Identity Platform'da
 *    doğrulanır; sahte "her 6 hane geçer" adımı kaldırıldı.
 * MFA kaydı zorunluysa ve hesapta yoksa korumalı alan kullanıcıyı `/account/security`'ye yönlendirir.
 */
export default function LoginPage() {
  const [step, setStep] = useState<"credentials" | "totp">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "warning" } | null>(null);
  const resolver = useRef<MultiFactorResolver | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  // Oturum bağlamı buraya `?neden=...` ile yönlendirir (F2.4, F3.3, F3.4).
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("neden") as SignOutReason | null;
    if (reason && reason in SIGN_OUT_MESSAGES) {
      setNotice({ text: SIGN_OUT_MESSAGES[reason], tone: SIGN_OUT_TONES[reason] });
    }
  }, []);

  useEffect(() => {
    if (step === "totp") codeInput.current?.focus();
  }, [step]);

  const credentials = useAsyncAction(async (): Promise<"done" | "totp"> => {
    const { auth } = clientsOrThrow();
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return "done";
    } catch (err) {
      const mfa = mfaResolverFrom(auth, err);
      if (!mfa) throw err;
      totpHint(mfa); // yalnızca TOTP destekleniyor; yoksa açık hata
      resolver.current = mfa;
      return "totp";
    }
  });

  const verify = useAsyncAction(async () => {
    if (!resolver.current) throw new AppError("failed-precondition", "Lütfen önce e-posta ve şifrenizi girin.");
    try {
      await completeTotpSignIn(resolver.current, code);
      return true as const;
    } catch (err) {
      if (EXPIRED_MFA_SESSION.has(String((err as { code?: unknown }).code))) {
        resolver.current = null;
        setCode("");
        setStep("credentials");
      }
      throw err;
    }
  });

  async function onCredentials(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    verify.reset();
    const result = await credentials.run();
    if (result === "done") hardNavigate("/dashboard");
    if (result === "totp") {
      setPassword("");
      setStep("totp");
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (await verify.run()) hardNavigate("/dashboard");
  }

  function backToCredentials() {
    resolver.current = null;
    setCode("");
    verify.reset();
    setStep("credentials");
  }

  const error = step === "credentials" ? credentials.error || verify.error : verify.error;

  return (
    <main className="auth-screen">
      <article className="auth-card" aria-labelledby="login-page-heading">
        <div className="brand-header auth-brand">
          <div className="brand-mark" aria-hidden="true">
            P
          </div>
          <div>
            <h1 id="login-page-heading" className="auth-title">
              {step === "credentials" ? "Pediatrist'e giriş" : "İki aşamalı doğrulama"}
            </h1>
            <span className="page-header-subtitle">Pediatri Eğitim Kliniği Platformu</span>
          </div>
        </div>

        <div className="auth-stack">
          {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
          {error && <Alert tone="critical">{error}</Alert>}

          {step === "credentials" ? (
            <form id="auth-credentials-form" onSubmit={onCredentials} noValidate>
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
              <Field label="Şifre" required>
                {(p) => (
                  <input
                    {...p}
                    type="password"
                    className="form-input"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                )}
              </Field>
              <Button
                id="login-submit-btn"
                type="submit"
                className="btn-block"
                loading={credentials.pending}
                loadingText="Giriş yapılıyor…"
              >
                Giriş yap
              </Button>
              <div className="auth-links">
                <Link href="/reset">Şifremi unuttum</Link>
                <Link id="login-to-register-link" href="/register">
                  Üyelik başvurusu yap
                </Link>
              </div>
            </form>
          ) : (
            <form id="auth-mfa-form" onSubmit={onVerify} noValidate>
              <p className="page-header-subtitle auth-hint">
                Telefonunuzdaki Authenticator uygulamasında <strong>Pediatrist</strong> için görünen 6 haneli kodu
                girin.
              </p>
              <Field label="Doğrulama kodu" hint="Kod her 30 saniyede bir yenilenir." required>
                {(p) => (
                  <input
                    {...p}
                    ref={codeInput}
                    type="text"
                    className="form-input mono-num totp-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={7}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, ""))}
                  />
                )}
              </Field>
              <div className="ui-actions">
                <Button variant="secondary" onClick={backToCredentials} disabled={verify.pending}>
                  Geri
                </Button>
                <Button type="submit" loading={verify.pending} loadingText="Doğrulanıyor…">
                  Doğrula ve giriş yap
                </Button>
              </div>
            </form>
          )}
        </div>
      </article>
    </main>
  );
}
