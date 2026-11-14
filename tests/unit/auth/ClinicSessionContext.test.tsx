// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * F13.4 (dış #14a): profil geri çağrısı async'tir. `await` sürerken oturum kapanır ya da yeni bir profil anlık
 * görüntüsü gelirse, eski çağrı state yazmamalı. Firebase modülleri burada yalnızca olay kaynağı olarak
 * taklit edilir (uygulama kodu değil; test verisi bu dosyada kalır).
 */
const fb = vi.hoisted(() => ({
  authListener: null as null | ((user: unknown) => void),
  snapshotListener: null as null | ((snap: unknown) => unknown),
}));

vi.mock("@/lib/firebase/client", () => ({ initPediatristFirebase: () => ({ auth: {}, db: {} }) }));
vi.mock("firebase/auth", () => ({
  multiFactor: () => ({ enrolledFactors: [] }),
  signOut: vi.fn(async () => undefined),
  onIdTokenChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    fb.authListener = cb;
    return () => {};
  },
}));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => path.join("/"),
  getDoc: async () => ({ data: () => ({ requireMfa: false, requireEmailVerified: false }) }),
  onSnapshot: (_ref: unknown, next: (snap: unknown) => unknown) => {
    fb.snapshotListener = next;
    return () => {};
  },
}));

const { ClinicSessionProvider, useClinicSession } = await import("@/lib/auth/ClinicSessionContext");

function Probe() {
  const { phase, session } = useClinicSession();
  return <p data-testid="phase">{`${phase}:${session?.fullName ?? "-"}`}</p>;
}

function deferredToken() {
  let resolve!: (v: unknown) => void;
  const promise = new Promise((r) => (resolve = r));
  const token = { authTime: new Date(0).toUTCString(), claims: { role: "user", status: "active" } };
  return { promise, resolve: () => resolve(token) };
}

const profile = (fullName: string) => ({
  exists: () => true,
  data: () => ({ fullName, title: "Dr.", role: "user", status: "active", email: "a@b.test" }),
});

describe("ClinicSessionContext (F13.4: async yarış)", () => {
  it("token beklenirken oturum kapanırsa eski çağrı oturumu 'hazır' olarak geri getirmez", async () => {
    render(
      <ClinicSessionProvider>
        <Probe />
      </ClinicSessionProvider>
    );
    const token = deferredToken();
    const user = { uid: "u1", email: "a@b.test", emailVerified: true, getIdTokenResult: () => token.promise };
    act(() => fb.authListener!(user));
    act(() => {
      void fb.snapshotListener!(profile("Ayşe")); // async dinleyici: tamamlanmasını beklemeden sonraki olay
    });
    act(() => fb.authListener!(null)); // başka sekmede çıkış
    expect(screen.getByTestId("phase").textContent).toBe("signedOut:-");

    await act(async () => token.resolve());
    expect(screen.getByTestId("phase").textContent).toBe("signedOut:-");
  });

  it("sırasız tamamlanan iki profil görüntüsünden en yenisi kazanır", async () => {
    render(
      <ClinicSessionProvider>
        <Probe />
      </ClinicSessionProvider>
    );
    const tokens = [deferredToken(), deferredToken()];
    let call = 0;
    const user = { uid: "u1", email: "a@b.test", emailVerified: true, getIdTokenResult: () => tokens[call++].promise };
    act(() => fb.authListener!(user));
    act(() => {
      void fb.snapshotListener!(profile("Eski Ad")); // async dinleyici: tamamlanmasını beklemeden sonraki olay
    });
    act(() => {
      void fb.snapshotListener!(profile("Yeni Ad")); // async dinleyici: tamamlanmasını beklemeden sonraki olay
    });

    await act(async () => tokens[1].resolve());
    expect(screen.getByTestId("phase").textContent).toBe("ready:Yeni Ad");
    await act(async () => tokens[0].resolve());
    expect(screen.getByTestId("phase").textContent).toBe("ready:Yeni Ad");
  });
});
