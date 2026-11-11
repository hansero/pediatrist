/**
 * Filigran (F6.3, D11): görüntüleyen hekimin adı, e-postası ve zamanı çapraz ve tekrarlı. PDF'te canvas'a
 * yakılır (ekran görüntüsünde kalır); video/görselde üst katmandır. Caydırıcıdır; gerçek DRM değildir.
 */
export function watermarkText(name: string, email: string, atMs: number): string {
  const when = new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(atMs);
  return `${name} · ${email} · ${when}`;
}

export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
  scale = 1
): void {
  ctx.save();
  ctx.font = `${Math.round(14 * scale)}px sans-serif`;
  ctx.fillStyle = "rgba(15, 29, 46, 0.14)";
  ctx.textBaseline = "middle";
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 6);
  const step = ctx.measureText(text).width + 80 * scale;
  const rowGap = 120 * scale;
  const span = Math.hypot(width, height);
  for (let y = -span / 2; y < span / 2; y += rowGap) {
    const offset = (Math.round(y / rowGap) % 2) * (step / 2);
    for (let x = -span / 2 - offset; x < span / 2; x += step) ctx.fillText(text, x, y);
  }
  ctx.restore();
}
