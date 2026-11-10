/** Koşullu sınıf adı birleştirici. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Durum tonları: tek sözlük (F3.1). CSS: `.sec-chip.<tone>`, `.clinical-alert.<tone>`. */
export type Tone = "success" | "warning" | "critical" | "info";
