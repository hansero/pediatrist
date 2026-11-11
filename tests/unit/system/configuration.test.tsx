// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfigurationError } from "@/components/system/ConfigurationError";
import { isFirebaseConfigured, missingFirebaseConfig } from "@/lib/firebase/config";

const full = {
  apiKey: "anahtar-degeri",
  authDomain: "ornek.firebaseapp.com",
  projectId: "ornek-proje",
  storageBucket: "ornek.appspot.com",
  messagingSenderId: "123",
  appId: "1:123:web:abc",
};

describe("Firebase yapılandırma denetimi (F7.5)", () => {
  it("eksik zorunlu değişkenlerin yalnızca ADLARINI döndürür; boşluk eksik sayılır", () => {
    expect(missingFirebaseConfig(full)).toEqual([]);
    expect(isFirebaseConfigured(full)).toBe(true);
    expect(missingFirebaseConfig({ ...full, apiKey: "", storageBucket: "  " })).toEqual([
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    ]);
    // Gönderen kimliği (messaging) zorunlu değil.
    expect(isFirebaseConfigured({ ...full, messagingSenderId: "" })).toBe(true);
  });

  it("hata sayfası eksik adları listeler, hiçbir değer göstermez, demo yolu sunmaz", () => {
    const { container } = render(
      <ConfigurationError missing={missingFirebaseConfig({ ...full, apiKey: "", appId: "" })} />
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Sunucu bağlantısı yapılandırılmamış");
    expect(screen.getByRole("alert").textContent).toContain("giriş yapılamaz");
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      "NEXT_PUBLIC_FIREBASE_APP_ID",
    ]);
    for (const value of Object.values(full)) expect(container.textContent).not.toContain(value);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
