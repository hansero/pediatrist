import { describe, expect, it } from "vitest";
import { passwordProblem } from "@/lib/auth/password";

describe("passwordProblem (kayıt formu ön kontrolü)", () => {
  it("kısa, yalnız harf veya yalnız rakam şifreyi Türkçe açıklar; uygun şifrede boş döner", () => {
    expect(passwordProblem("Ab1")).toContain("en az 8");
    expect(passwordProblem("sadeceharf")).toContain("harf ve rakam");
    expect(passwordProblem("12345678")).toContain("harf ve rakam");
    expect(passwordProblem("Çiçek2026")).toBe("");
  });
});
