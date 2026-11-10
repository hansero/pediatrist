import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { formatIssues } from "./shared/issues";

// Şemalarda açık mesajı olmayan kurallar için Türkçe varsayılan mesajlar.
z.config(z.locales.tr());

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
