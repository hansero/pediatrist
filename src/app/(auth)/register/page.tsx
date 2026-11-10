"use client";

import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import type { ResidencyYear, Title } from "@shared/constants";
import { completeRegistration } from "@/lib/firebase/callables";
import { initPediatristFirebase } from "@/lib/firebase/client";
import { toUserMessage } from "@/lib/errors";
import { Button } from "@/components/ui/Button";

/**
 * Üyelik başvurusu (F2.3): hesap Firebase Auth'ta açılır, profil SUNUCUDA `completeRegistration` ile yazılır
 * (D4; istemci `users` dokümanı yazamaz). Geçerli davet kodu → üyelik doğrudan aktif.
 * UX yenilemesi (KVKK onayı, e-posta doğrulama, şifre tekrarı) F3.5'te.
 */
export default function RegisterPage() {
  const [title, setTitle] = useState<Title>("Asistan Dr.");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [residencyYear, setResidencyYear] = useState("1");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSubmitting(true);

    try {
      const clients = initPediatristFirebase();
      if (!clients) throw new Error("not-configured");
      const normalizedEmail = email.trim().toLowerCase();

      // Yarım kalmış kayıt: hesap açılmış ama profil yazılamamışsa (ör. davet kodu hatası) hesabı
      // yeniden açmaya çalışmadan profili tamamla.
      const current = clients.auth.currentUser;
      if (!current || current.email?.toLowerCase() !== normalizedEmail) {
        await createUserWithEmailAndPassword(clients.auth, normalizedEmail, password);
      }

      const result = await completeRegistration({
        title,
        fullName,
        residencyYear: Number(residencyYear) as ResidencyYear,
        inviteCode,
      });
      window.location.href = result.status === "active" ? "/dashboard" : "/pending";
    } catch (err) {
      setErrorMessage(toUserMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-screen">
      <article className="auth-card" aria-labelledby="register-page-heading">
        <h1 id="register-page-heading">Klinik Hekim Üyelik Başvurusu</h1>
        <p className="page-header-subtitle" style={{ marginBottom: "1.25rem" }}>
          Kapalı devre güvenlik politikası gereği başvurunuz Eğitim Sorumlusu (Prof. Dr.) onayından sonra aktifleşir.
        </p>

        {errorMessage && (
          <div role="alert" className="clinical-alert critical" style={{ marginBottom: "1rem" }}>
            {errorMessage}
          </div>
        )}

        <form id="register-member-form" onSubmit={handleRegisterSubmit}>
          <div className="grid-2" style={{ gap: "0.65rem" }}>
            <div className="form-group">
              <label htmlFor="register-title-select" className="form-label">
                Akademik / Klinik Unvan
              </label>
              <select
                id="register-title-select"
                className="form-select"
                value={title}
                onChange={(e) => setTitle(e.target.value as Title)}
              >
                <option value="Asistan Dr.">Asistan Dr.</option>
                <option value="Uzm. Dr.">Uzm. Dr.</option>
                <option value="Doç. Dr.">Doç. Dr.</option>
                <option value="Prof. Dr.">Prof. Dr.</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="register-year-select" className="form-label">
                Pediatri Kıdem Yılı
              </label>
              <select
                id="register-year-select"
                className="form-select"
                value={residencyYear}
                onChange={(e) => setResidencyYear(e.target.value)}
              >
                <option value="1">1. Yıl Asistanı</option>
                <option value="2">2. Yıl Asistanı</option>
                <option value="3">3. Yıl Asistanı (Kıdemli)</option>
                <option value="4">4. Yıl / Başasistan</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="register-fullname-input" className="form-label">
              Ad Soyad
            </label>
            <input
              id="register-fullname-input"
              type="text"
              className="form-input"
              placeholder="Örn: Dr. Ayşe Yılmaz"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="register-email-input" className="form-label">
              Kurumsal E-Posta Adresi
            </label>
            <input
              id="register-email-input"
              type="email"
              className="form-input"
              placeholder="ayse.yilmaz@pediatri.edu.tr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="register-password-input" className="form-label">
              Oturum Şifresi (En az 8 karakter)
            </label>
            <input
              id="register-password-input"
              type="password"
              minLength={8}
              className="form-input"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="register-invite-input" className="form-label">
              Klinik Davet Kodu (Varsa)
            </label>
            <input
              id="register-invite-input"
              type="text"
              className="form-input mono-num"
              placeholder="PED-KLİNİK-2026"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          </div>

          <Button
            id="register-submit-btn"
            type="submit"
            style={{ width: "100%" }}
            loading={submitting}
            loadingText="Başvuru Kaydediliyor…"
          >
            Üyelik Başvurusunu Eğitim Sorumlusuna Gönder
          </Button>

          <div style={{ marginTop: "1rem", textAlign: "center", fontSize: "0.82rem" }}>
            <a id="register-to-login-link" href="/login" style={{ color: "var(--clinical-primary)", fontWeight: 600 }}>
              Zaten onaylı hesabınız var mı? Giriş Ekranına Dönün
            </a>
          </div>
        </form>
      </article>
    </main>
  );
}
