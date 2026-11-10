import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";

// Şemalarda açık mesajı olmayan kurallar için Türkçe varsayılan mesajlar.
z.config(z.locales.tr());

type Issue = { path: PropertyKey[]; message: string };

/** zod sorunlarını kullanıcıya gösterilecek tek bir Türkçe mesaja çevirir. */
export function formatIssues(issues: readonly Issue[]): string {
  const parts = issues.slice(0, 3).map((issue) => {
    const [first, second] = issue.path;
    // Sınav soruları: CSV'deki fiziksel satır (başlık = 1 → ilk soru = 2).
    if (first === "questions" && typeof second === "number") return `Satır ${second + 2}: ${issue.message}`;
    return issue.message;
  });
  const extra = issues.length > 3 ? ` (+${issues.length - 3} hata daha)` : "";
  return parts.join(" ") + extra;
}

/** İsteği şemayla doğrular; geçersizse `invalid-argument` fırlatır. İstemci doğrulamasına güvenilmez. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    throw new HttpsError("invalid-argument", formatIssues(result.error.issues), {
      issues: result.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })),
    });
  }
  return result.data;
}
