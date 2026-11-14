/**
 * zod doğrulama sorunlarını kullanıcıya gösterilecek tek bir Türkçe mesaja çevirir.
 * Sunucu (`validate.ts`) ve istemci (`src/lib/firebase/callables.ts`) aynı biçimi kullanır.
 */
export interface ValidationIssue {
  path: PropertyKey[];
  message: string;
}

export function formatIssues(issues: readonly ValidationIssue[]): string {
  const parts = issues.slice(0, 3).map((issue) => {
    const [first, second] = issue.path;
    // Sınav soruları: gönderilen sıradaki soru numarası. CSV satırı kullanılamaz: önizlemede sorular yeniden
    // sıralanıp silinebilir (F14); satır numarasını istemci kendisi gösterir.
    if (first === "questions" && typeof second === "number") return `Soru ${second + 1}: ${issue.message}`;
    return issue.message;
  });
  const extra = issues.length > 3 ? ` (+${issues.length - 3} hata daha)` : "";
  return parts.join(" ") + extra;
}
