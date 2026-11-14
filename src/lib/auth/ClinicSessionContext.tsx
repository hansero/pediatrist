"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { multiFactor, onIdTokenChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc, onSnapshot, type Timestamp } from "firebase/firestore";
import { parseSecurityConfig, SECURITY_CONFIG, type SecurityConfig } from "@shared/security";
import type { MemberDoc } from "@shared/types";
import { toUserMessage, NOT_CONFIGURED_MESSAGE } from "@/lib/errors";
import { initPediatristFirebase } from "@/lib/firebase/client";
import { evaluateSession, type SignOutReason } from "@/lib/auth/sessionDecision";
import type { ClinicMemberSession } from "@/lib/auth/types";

/**
 * Oturum bağlamı (F2.4).
 *
 * - Firebase Auth durumu ve kullanıcının KENDİ profil dokümanı (`users/{uid}`) canlı dinlenir.
 * - Rol ve durum yalnızca dokümandan okunur (D3). Admin onayladığında ekran yenilemeden aktif olur;
 *   askıya alındığında veya oturum iptal edildiğinde oturum anında kapanır.
 * - Claim'ler yalnızca önbellektir; dokümandan farklıysa token bir kez yenilenir (döngü koruması var).
 */
export type SessionPhase = "loading" | "signedOut" | "signingOut" | "needsProfile" | "ready" | "error";

interface SessionState {
  phase: SessionPhase;
  session: ClinicMemberSession | null;
  /** Geriye uyumluluk: `phase === "loading"`. */
  loading: boolean;
  /** `phase === "error"` iken kullanıcıya gösterilecek metin. */
  error: string;
  /**
   * Oturumu kapatır ve giriş sayfasına gider. Neden verilirse giriş sayfası Türkçe açıklamayı gösterir
   * (ör. `hareketsizlik`). `signOut` başarısız olursa hata fırlatılır ve oturum açık kalır.
   */
  signOutUser: (reason?: SignOutReason) => Promise<void>;
}

const ClinicSessionContext = createContext<SessionState>({
  phase: "loading",
  session: null,
  loading: true,
  error: "",
  signOutUser: async () => {},
});

type InternalState = Pick<SessionState, "phase" | "session" | "error">;

function toSession(
  user: User,
  profile: MemberDoc<Timestamp>,
  mfaVerified: boolean,
  security: SecurityConfig
): ClinicMemberSession {
  return {
    uid: user.uid,
    email: user.email ?? profile.email ?? "",
    fullName: String(profile.fullName ?? ""),
    title: String(profile.title ?? ""),
    residencyYear: typeof profile.residencyYear === "number" ? profile.residencyYear : null,
    role: profile.role === "admin" ? "admin" : "user",
    status: profile.status === "active" || profile.status === "suspended" ? profile.status : "pending",
    mfaVerified,
    mfaEnrolled: multiFactor(user).enrolledFactors.length > 0,
    emailVerified: user.emailVerified,
    mfaRequired: security.requireMfa,
    emailVerificationRequired: security.requireEmailVerified,
    consentVersion: typeof profile.consent?.version === "string" ? profile.consent.version : null,
  };
}

export function ClinicSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<InternalState>({ phase: "loading", session: null, error: "" });
  /** Aynı rol/durum için claim yenilemesini bir kez yap (yenileme → onIdTokenChanged → döngü olmasın). */
  const refreshedFor = useRef<string>("");
  /**
   * Nedenli oturum kapatma sürüyor mu? `signOut()` → `onIdTokenChanged(null)` → "signedOut" → layout'un
   * nedensiz `/login` yönlendirmesi, nedenli yönlendirmeyi (`?neden=...`) ezmesin diye (F2.4 e2e ile bulundu).
   */
  const signingOut = useRef(false);

  useEffect(() => {
    const clients = initPediatristFirebase();
    if (!clients) {
      setState({ phase: "error", session: null, error: NOT_CONFIGURED_MESSAGE });
      return;
    }
    const { auth, db } = clients;

    const endSession = async (reason: SignOutReason) => {
      if (signingOut.current) return;
      signingOut.current = true;
      setState({ phase: "signingOut", session: null, error: "" });
      await signOut(auth).catch(() => undefined);
      window.location.replace(`/login?neden=${reason}`);
    };

    let unsubscribeProfile: (() => void) | null = null;
    /**
     * Her kimlik değişiminde (giriş, çıkış, token yenileme) artar (F13.4). Profil geri çağrısı async'tir:
     * `await`'ler sürerken oturum kapanır ya da yenilenirse eski çağrı state yazmaz (yoksa kapanmış oturum
     * "hazır" olarak geri gelebilirdi).
     */
    let generation = 0;
    const unsubscribeAuth = onIdTokenChanged(auth, (user) => {
      const gen = ++generation;
      /** Aynı oturumda art arda gelen profil anlık görüntülerinden yalnızca en sonuncusu state yazar. */
      let latestSnapshot = 0;
      unsubscribeProfile?.();
      unsubscribeProfile = null;
      if (!user) {
        if (!signingOut.current) setState({ phase: "signedOut", session: null, error: "" });
        return;
      }

      // Ortam güvenlik ayarı (N8): kurallar ve sunucuyla aynı doküman. Okunamazsa MFA zorunlu sayılır.
      const security = getDoc(doc(db, SECURITY_CONFIG.collection, SECURITY_CONFIG.doc))
        .then((s) => parseSecurityConfig(s.data()))
        .catch(() => parseSecurityConfig(null));

      // Bu oturumda profil görüldü mü? Sonradan kaybolursa hesap silinmiştir (F9.1).
      let hadProfile = false;
      unsubscribeProfile = onSnapshot(
        doc(db, "users", user.uid),
        async (snap) => {
          const mine = ++latestSnapshot;
          const stale = () => gen !== generation || mine !== latestSnapshot;
          const profile = snap.exists() ? (snap.data() as MemberDoc<Timestamp>) : null;
          // Önceki anlık görüntülerde profil vardı mı? `await`'ten ÖNCE kaydedilir: bayat sayılıp erken dönen bir
          // görüntü de "profil görüldü" bilgisini bırakır (hesap silme algısı kaybolmaz).
          const profileSeenBefore = hadProfile;
          if (profile) hadProfile = true;
          // Hesap silindiyse belirteç alınamayabilir; karar için oturum açma anı gerekmez.
          const token = await user.getIdTokenResult().catch(() => null);
          if (stale()) return;
          if (!token) {
            if (!profile && profileSeenBefore) await endSession("hesap-silindi");
            return;
          }
          const decision = evaluateSession(
            profile,
            {
              authTimeSeconds: Math.floor(Date.parse(token.authTime) / 1000),
              claimRole: token.claims.role,
              claimStatus: token.claims.status,
            },
            profileSeenBefore
          );

          if (decision.kind === "needsProfile") {
            setState({ phase: "needsProfile", session: null, error: "" });
            return;
          }
          if (decision.kind === "signOut") {
            await endSession(decision.reason);
            return;
          }

          const key = `${user.uid}:${decision.role}:${decision.status}`;
          if (decision.refreshClaims && refreshedFor.current !== key) {
            refreshedFor.current = key;
            void user.getIdToken(true).catch(() => undefined);
          }
          const securityConfig = await security;
          if (stale()) return;
          setState({
            phase: "ready",
            session: toSession(user, profile!, Boolean(token.signInSecondFactor), securityConfig),
            error: "",
          });
        },
        (err) => {
          if (gen === generation) setState({ phase: "error", session: null, error: toUserMessage(err) });
        }
      );
    });

    return () => {
      generation += 1; // kapanışta uçuştaki geri çağrılar state yazmaz
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, []);

  const signOutUser = async (reason?: SignOutReason) => {
    const clients = initPediatristFirebase();
    // Çıkış sürerken onIdTokenChanged(null) → "signedOut" → nedensiz /login yönlendirmesi bastırılır (F2.4).
    signingOut.current = true;
    try {
      if (clients) await signOut(clients.auth);
    } catch (err) {
      signingOut.current = false;
      throw err;
    }
    setState({ phase: "signingOut", session: null, error: "" });
    window.location.replace(reason ? `/login?neden=${reason}` : "/login");
  };

  return (
    <ClinicSessionContext.Provider value={{ ...state, loading: state.phase === "loading", signOutUser }}>
      {children}
    </ClinicSessionContext.Provider>
  );
}

export function useClinicSession() {
  return useContext(ClinicSessionContext);
}
