import { Alert } from "./Alert";

/**
 * Sınırlı liste uyarısı (F8.2): liste üst sınıra ulaştıysa bunu açıkça söyler; kullanıcı eksik listeyi tam
 * sanmasın. `truncated` yanlışken hiçbir şey çizmez.
 */
export function ListLimitNotice({
  truncated,
  cap,
  what,
  hint,
}: {
  truncated: boolean;
  cap: number;
  /** Çoğul ad, küçük harfle (ör. "üye", "sınav"). */
  what: string;
  /** Ne yapılabileceği (ör. "Aramayı kullanın."). */
  hint?: string;
}) {
  if (!truncated) return null;
  return (
    <Alert tone="warning">
      Yalnızca {cap} {what} gösteriliyor; daha fazlası var. {hint}
    </Alert>
  );
}
