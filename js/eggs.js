// Match to Hatch's eggs, drawn on the host screen and on phones: each player's
// egg in their color, with a crack network that spreads as it fills up.
import { playerColor } from './common.js';

/** playerId -> egg color (hex): each player's own color, which is unique in the room. */
export function eggColors(s) {
  const players = new Map(s.players.map((p) => [p.id, p]));
  return new Map(s.game.eggs.map(({ id }) => [id, playerColor(players.get(id))]));
}

/** `hex` mixed toward white by `amount` (0-1). */
function tintUp(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0')).join('')}`;
}

// The egg outline (from Microsoft Fluent Emoji's 🥚, MIT license: public/licenses/), on a 32×32 grid.
const EGG_PATH = 'M16.33 2C13.76 2 11.35 3.28 9.91 5.4L9.78 5.59C6.91 9.82 5.61 14.92 6.1 20L6.18 20.8C6.68 26.01 11.06 29.98 16.29 29.98C21.54 29.98 25.92 25.99 26.4 20.76L26.49 19.83C26.97 14.71 25.63 9.58 22.71 5.35C21.26 3.26 18.88 2 16.33 2Z';
let gradientId = 0;

/** The egg shell in `hex`: lit from the top right and shaded toward the bottom. */
function shell(hex) {
  const id = `egg${++gradientId}`; // every egg on the page needs its own gradient ids
  return `
    <svg class="mh-shell" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id="${id}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(21 9.5) rotate(95) scale(23 17)">
          <stop offset="0" stop-color="${tintUp(hex, 0.65)}"/>
          <stop offset="0.5" stop-color="${hex}"/>
          <stop offset="1" stop-color="${shade(hex, 0.35)}"/>
        </radialGradient>
      </defs>
      <path d="${EGG_PATH}" fill="url(#${id})"/>
      <ellipse cx="20.6" cy="8.6" rx="2.2" ry="3.3" transform="rotate(-25 20.6 8.6)" fill="#fff" opacity=".45"/>
    </svg>`;
}

/** `hex` darkened toward black by `amount` (0-1). */
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.round(c * (1 - amount)).toString(16).padStart(2, '0')).join('')}`;
}

// ---- cracks --------------------------------------------------------------------
// The egg's crack network, drawn over the 32×32 egg emoji in 10 stages. It
// starts as one fracture near the top, and every later crack branches off the
// end or a corner of an earlier one, so the cracks spread from a single point
// until they reach both sides and loop around the bottom, ready to split.
// Each crack is a filled shape that is `w` wide where it starts and tapers to a
// point, with a darker, narrower core inside for depth.

const CRACK_LINES = [
  { w: 1.5, pts: [[17.5, 10.8], [16.2, 12.6], [17.4, 13.9], [16, 15.6]] },
  { w: 1.2, pts: [[17.5, 10.8], [19.1, 9.7], [18.6, 8.3], [20.2, 7.1]] },
  { w: 1.2, pts: [[16, 15.6], [14.4, 16.5], [14.9, 18], [12.8, 19.2], [13.2, 20.7]] },
  { w: 1, pts: [[16.2, 12.6], [14.6, 12.1], [13.4, 13.4], [11.6, 12.8], [10.3, 14.2]] },
  { w: 1.1, pts: [[16, 15.6], [17.9, 16.8], [19.6, 16.1], [20.5, 17.8], [22.4, 18.3]] },
  { w: .8, pts: [[20.2, 7.1], [19.4, 5.8], [20.1, 4.5]] },
  { w: .9, pts: [[13.2, 20.7], [14.8, 22.1], [14.2, 23.8], [16, 25.2], [15.6, 26.9]] },
  { w: .8, pts: [[10.3, 14.2], [9.4, 15.8], [7.7, 16.4], [6.5, 17.9]] },
  { w: .8, pts: [[22.4, 18.3], [23.5, 19.9], [25, 19.5], [26.2, 20.7]] },
  { w: .9, pts: [[16, 25.2], [18, 24.4], [18.6, 22.8], [20.6, 22.3], [21, 20.3], [22.4, 18.3]] },
];

/** A polyline as a filled outline `start` wide at its first point, narrowing to `end`. */
function taper(pts, start, end) {
  const along = [0];
  for (let i = 1; i < pts.length; i++) along.push(along[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const length = along.at(-1);
  const left = [], right = [];
  pts.forEach(([x, y], i) => {
    const [px, py] = pts[Math.max(0, i - 1)];
    const [nx, ny] = pts[Math.min(pts.length - 1, i + 1)];
    const d = Math.hypot(nx - px, ny - py) || 1;
    const half = (start + (end - start) * (along[i] / length)) / 2;
    const ox = (-(ny - py) / d) * half, oy = ((nx - px) / d) * half;
    left.push([x + ox, y + oy]);
    right.push([x - ox, y - oy]);
  });
  return `M${[...left, ...right.reverse()].map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L')}Z`;
}

const CRACKS = CRACK_LINES.map(({ w, pts }) => ({
  origin: pts[0],
  outer: taper(pts, w, 0.08),
  core: taper(pts, w * 0.45, 0.02),
}));

/**
 * An egg in color `color` (hex) with `cracks` cracks, glowing brighter as they
 * build up. Cracks past `old` are new this round: the egg shakes and they grow in.
 */
export function egg(cracks, total, { old = cracks, cls = '', color = '#ff9330' } = {}) {
  const light = cracks / total;
  const tint = color;
  // Crack stages follow progress, in case hatching takes more or fewer than 10.
  const stage = (n) => Math.round((n / total) * CRACKS.length);
  const shown = stage(cracks), before = stage(old);
  return `
    <div class="mh-egg ${cls} ${cracks > old ? 'gained' : ''}" style="--light:${light.toFixed(2)}">
      <div class="mh-rays"></div>
      <div class="mh-glow"></div>
      ${shell(tint)}
      <svg class="mh-cracks" viewBox="0 0 32 32" aria-hidden="true" style="--crack:${shade(tint, 0.45)}; --core:${shade(tint, 0.72)}">${CRACKS.slice(0, shown).map(({ origin, outer, core }, i) => `
        <g class="${i >= before ? 'new' : ''}" style="--i:${i - before}; transform-origin:${origin[0]}px ${origin[1]}px">
          <path class="crack-outer" d="${outer}"/>
          <path class="crack-core" d="${core}"/>
        </g>`).join('')}
      </svg>
    </div>`;
}
