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
    // Sınav soruları: CSV'deki fiziksel satır (başlık = 1 → ilk soru = 2).
    if (first === "questions" && typeof second === "number") return `Satır ${second + 2}: ${issue.message}`;
    return issue.message;
  });
  const extra = issues.length > 3 ? ` (+${issues.length - 3} hata daha)` : "";
  return parts.join(" ") + extra;
}
