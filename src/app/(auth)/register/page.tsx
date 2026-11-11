"use client";

import Link from "next/link";
import React, { useState } from "react";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { KVKK_NOTICE_VERSION } from "@shared/consent";
import { isResidentTitle, RESIDENCY_YEARS, TITLES, type ResidencyYear, type Title } from "@shared/constants";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { notConfiguredError } from "@/lib/errors";
import { completeRegistration } from "@/lib/firebase/callables";
import { initPediatristFirebase } from "@/lib/firebase/client";
import { kvkkController } from "@/lib/kvkk";
import { hardNavigate } from "@/lib/navigation";
import { PASSWORD_MIN_LENGTH, passwordProblem } from "@/lib/auth/password";

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  passwordRepeat?: string;
  consent?: string;
}

/**
 * Üyelik başvurusu (F2.3, F3.5).
 * Sıra: Auth hesabı → profil SUNUCUDA (`completeRegistration`, D4; KVKK onay sürümüyle) → doğrulama e-postası.
 * E-posta gönderimi başarısız olsa bile başvuru tamamdır; bekleme ekranında yeniden gönderilebilir.
 * Yarım kalmış kayıt (hesap açık, profil yok) aynı formla tamamlanır; hesap yeniden açılmaz.
 */
export default function RegisterPage() {
  const controller = kvkkController();
  const [title, setTitle] = useState<Title>("Asistan Dr.");
  const [residencyYear, setResidencyYear] = useState<ResidencyYear>(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const resident = isResidentTitle(title);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (fullName.trim().length < 2) next.fullName = "Ad soyad en az 2 karakter olmalı.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Geçerli bir e-posta adresi girin.";
    const pw = passwordProblem(password);
    if (pw) next.password = pw;
    if (password !== passwordRepeat) next.passwordRepeat = "Şifreler aynı değil.";
    if (!consent) next.consent = "Devam etmek için aydınlatma metnini okuduğunuzu onaylayın.";
    return next;
  }

  const submit = useAsyncAction(async () => {
    const clients = initPediatristFirebase();
    if (!clients) throw notConfiguredError();
    const normalizedEmail = email.trim().toLowerCase();

    const current = clients.auth.currentUser;
    const user =
      current && current.email?.toLowerCase() === normalizedEmail
        ? current
        : (await createUserWithEmailAndPassword(clients.auth, normalizedEmail, password)).user;

    const result = await completeRegistration({
      title,
      fullName,
      ...(resident ? { residencyYear } : {}),
      inviteCode,
      consentVersion: KVKK_NOTICE_VERSION,
    });

    if (!user.emailVerified) {
      // Başvuru tamamlandı; e-posta gönderilemezse bekleme ekranından yeniden gönderilebilir.
      await sendEmailVerification(user).catch((err: unknown) => console.warn("[kayıt] doğrulama e-postası", err));
    }
    return result;
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    // Etkin üye panele, onay bekleyen bekleme ekranına (korumalı alan canlı dinler, onayda kendiliğinden açılır).
    if (await submit.run()) hardNavigate("/dashboard");
  }

  return (
    <main className="auth-screen">
      <article className="auth-card register-card" aria-labelledby="register-page-heading">
        <div className="brand-header auth-brand">
          <div className="brand-mark" aria-hidden="true">
            P
          </div>
          <div>
            <h1 id="register-page-heading" className="auth-title">
              Üyelik başvurusu
            </h1>
            <span className="page-header-subtitle">Başvurunuz eğitim sorumlusunun onayından sonra etkinleşir.</span>
          </div>
        </div>

        <form id="register-member-form" className="auth-stack" onSubmit={onSubmit} noValidate>
          {!controller && (
            <Alert tone="critical" title="Başvuru şu anda alınamıyor">
              KVKK aydınlatma metni için veri sorumlusu bilgileri yapılandırılmamış. Lütfen platform yöneticisine
              bildirin.
            </Alert>
          )}
          {submit.error && <Alert tone="critical">{submit.error}</Alert>}

          <div className="grid-2">
            <Field label="Ünvan" required>
              {(p) => (
                <select
                  {...p}
                  className="form-select"
                  value={title}
                  onChange={(e) => setTitle(e.target.value as Title)}
                >
                  {TITLES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {resident && (
              <Field label="Kıdem yılı" required>
                {(p) => (
                  <select
                    {...p}
                    className="form-select"
                    value={residencyYear}
                    onChange={(e) => setResidencyYear(Number(e.target.value) as ResidencyYear)}
                  >
                    {RESIDENCY_YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}. yıl
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}
          </div>

          <Field label="Ad soyad" error={errors.fullName} required>
            {(p) => (
              <input
                {...p}
                className="form-input"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            )}
          </Field>
          <Field label="E-posta" hint="Kurumsal e-posta adresinizi kullanın." error={errors.email} required>
            {(p) => (
              <input
                {...p}
                type="email"
                className="form-input"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          <Field
            label="Şifre"
            hint={`En az ${PASSWORD_MIN_LENGTH} karakter; harf ve rakam içersin.`}
            error={errors.password}
            required
          >
            {(p) => (
              <input
                {...p}
                type="password"
                className="form-input"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <Field label="Şifre (tekrar)" error={errors.passwordRepeat} required>
            {(p) => (
              <input
                {...p}
                type="password"
                className="form-input"
                autoComplete="new-password"
                value={passwordRepeat}
                onChange={(e) => setPasswordRepeat(e.target.value)}
              />
            )}
          </Field>
          <Field label="Davet kodu" hint="Eğitim sorumlusundan kod aldıysanız girin; üyeliğiniz hemen etkinleşir.">
            {(p) => (
              <input
                {...p}
                className="form-input mono-num"
                autoComplete="off"
                autoCapitalize="characters"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
            )}
          </Field>

          <div>
            <div className="consent-row">
              <input
                id="register-consent"
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                aria-invalid={errors.consent ? true : undefined}
                aria-describedby={errors.consent ? "register-consent-error" : undefined}
              />
              <label htmlFor="register-consent">
                <Link href="/kvkk" target="_blank" rel="noopener">
                  KVKK aydınlatma metnini
                </Link>{" "}
                okudum (sürüm {KVKK_NOTICE_VERSION}).
              </label>
            </div>
            {errors.consent && (
              <p id="register-consent-error" className="ui-field-error">
                {errors.consent}
              </p>
            )}
          </div>

          <Button
            id="register-submit-btn"
            type="submit"
            className="btn-block"
            loading={submit.pending}
            loadingText="Başvuru gönderiliyor…"
            disabled={!controller}
          >
            Başvuruyu gönder
          </Button>

          <div className="auth-links">
            <Link id="register-to-login-link" href="/login">
              Hesabınız var mı? Giriş yapın
            </Link>
          </div>
        </form>
      </article>
    </main>
  );
}
