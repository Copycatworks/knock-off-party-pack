// Drawings for Memory Draw, shared by the server (limits, validation) and the
// phones (drawing them). A drawing is a list of strokes:
//   { c: color index into INK, w: size index into SIZES, p: [x0, y0, x1, y1, ...] }
// with points on a 1000×1000 square, so it looks the same on any screen.

export const INK = [
  '#1d1a2e', '#ffffff', '#ff5a5f', '#ff9330', '#ffd23f', '#4cd97b',
  '#3fb8ff', '#3b5bdb', '#9061f9', '#ff7ab6', '#9a6538', '#ffc9a0',
];
export const SIZES = [8, 18, 40];
export const MAX_STROKES = 400;
export const MAX_POINTS = 8000;

/** A drawing from a phone, cleaned up: bad strokes dropped, points rounded and clamped, limits applied. */
export function sanitizeDrawing(strokes) {
  if (!Array.isArray(strokes)) return [];
  const out = [];
  let points = 0;
  for (const s of strokes.slice(0, MAX_STROKES)) {
    if (points >= MAX_POINTS) break;
    if (!s || !Number.isInteger(s.c) || !INK[s.c] || !Number.isInteger(s.w) || !SIZES[s.w] || !Array.isArray(s.p)) continue;
    const p = s.p.slice(0, (MAX_POINTS - points) * 2);
    if (p.length < 2 || p.length % 2 || !p.every(Number.isFinite)) continue;
    out.push({ c: s.c, w: s.w, p: p.map((n) => Math.min(1000, Math.max(0, Math.round(n)))) });
    points += p.length / 2;
  }
  return out;
}

/** Draws strokes onto a canvas (cleared to white first). Phones only. */
export function paintDrawing(canvas, strokes) {
  const ctx = canvas.getContext('2d');
  const scale = canvas.width / 1000;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const s of strokes ?? []) paintStroke(ctx, s, scale);
}

/** Draws one stroke (or, with `from`, only its points from that index on). */
export function paintStroke(ctx, s, scale, from = 0) {
  ctx.strokeStyle = ctx.fillStyle = INK[s.c];
  ctx.lineWidth = SIZES[s.w] * scale;
  ctx.lineCap = ctx.lineJoin = 'round';
  const p = s.p;
  if (p.length === 2) {
    ctx.beginPath();
    ctx.arc(p[0] * scale, p[1] * scale, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const start = Math.max(0, from - 2);
  ctx.beginPath();
  ctx.moveTo(p[start] * scale, p[start + 1] * scale);
  for (let i = start + 2; i < p.length; i += 2) ctx.lineTo(p[i] * scale, p[i + 1] * scale);
  ctx.stroke();
}
