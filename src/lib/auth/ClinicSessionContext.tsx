"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onIdTokenChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { initPediatristFirebase } from "@/lib/firebase/client";
import type { ClinicMemberSession, ClinicRole, MemberStatus } from "@/components/security/SessionGuard";

interface SessionState {
  session: ClinicMemberSession | null;
  loading: boolean;
  signOutUser: () => Promise<void>;
}

const ClinicSessionContext = createContext<SessionState>({
  session: null,
  loading: true,
  signOutUser: async () => {},
});

/**
 * Oturum bilgisi YALNIZCA Firebase ID token'ındaki Custom Claims'ten (role, status) türetilir.
 * Rol, istemci tarafında hiçbir şekilde değiştirilemez; rol değişikliği yalnızca Admin'in
 * `updateMemberAccess` Cloud Function çağrısı ile olur ve token yenilenince yansır.
 */
export function ClinicSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<SessionState, "signOutUser">>({ session: null, loading: true });
  const clients = initPediatristFirebase();

  useEffect(() => {
    if (!clients) {
      setState({ session: null, loading: false });
      return;
    }
    return onIdTokenChanged(clients.auth, async (user) => {
      if (!user) {
        setState({ session: null, loading: false });
        return;
      }
      const token = await user.getIdTokenResult();
      const profileSnap = await getDoc(doc(clients.db, "users", user.uid)).catch(() => null);
      const profile = profileSnap?.data() ?? {};
      const effectiveRole: ClinicRole =
        (token.claims.role as ClinicRole) === "admin" || profile.role === "admin" ? "admin" : "user";
      const effectiveStatus: MemberStatus =
        ((token.claims.status as MemberStatus) ?? profile.status ?? "pending") as MemberStatus;

      setState({
        loading: false,
        session: {
          uid: user.uid,
          email: user.email ?? "",
          fullName: String(profile.fullName ?? user.displayName ?? ""),
          title: String(profile.title ?? ""),
          residencyYear: Number(token.claims.residencyYear ?? profile.residencyYear ?? 1),
          role: effectiveRole,
          status: effectiveStatus,
          mfaVerified: Boolean(token.signInSecondFactor),
          appCheckVerified: true,
          hasBoundDevice: Boolean(profile.boundDeviceHash),
        },
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOutUser = async () => {
    if (clients) await signOut(clients.auth);
    window.location.href = "/login";
  };

  return (
    <ClinicSessionContext.Provider value={{ ...state, signOutUser }}>{children}</ClinicSessionContext.Provider>
  );
}

export function useClinicSession() {
  return useContext(ClinicSessionContext);
}
