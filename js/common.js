// UI helpers: escaping, avatars, storage, the halftone background and the countdown.
import { COLORS } from './looks.js';

export const $ = (sel, root = document) => root.querySelector(sel);

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const fmt = (n) => Number(n).toLocaleString();

/** A player's color as a hex value. */
export const playerColor = (player) => COLORS[player?.color] ?? '#c9c2b4';

/** A player's icon: their ASCII face on an orb of their color. */
export const avatar = (player, cls = '') => `
  <span class="avatar ${cls}" style="--pc:${playerColor(player)}" title="${esc(player?.name ?? '')}"><span class="face" data-len="${(player?.face ?? ':)').length}">${esc(player?.face ?? ':)')}</span></span>`;

/** Ranked list of { id, score, rank } with each player's icon; your row is marked. */
export function leaderboard(standings, players, youId) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const max = Math.max(1, ...standings.map((x) => x.score));
  return `<ol class="leaderboard">${standings.map((st, i) => {
    const p = byId.get(st.id) ?? { name: '?' };
    return `
      <li class="leader card rise ${st.rank === 1 ? 'first' : ''} ${st.id === youId ? 'me' : ''}"
          style="animation-delay:${0.15 + i * 0.1}s; --c:${playerColor(p)}; --w:${(st.score / max) * 100}%">
        <span class="rank">${ordinal(st.rank)}</span>
        ${avatar(p, 'tiny')}
        <span class="name">${esc(p.name)}</span>
        <span class="pts">${fmt(st.score)}</span>
        <span class="track"><span class="fill"></span></span>
      </li>`;
  }).join('')}</ol>`;
}

// sessionStorage is per tab (room seats, so several test players can share one
// browser); localStorage is per device (your name, color and face).
function makeStore(getStorage) {
  return {
    get(key) {
      try { return JSON.parse(getStorage().getItem(key)); } catch { return null; }
    },
    set(key, value) {
      try { getStorage().setItem(key, JSON.stringify(value)); } catch { /* private mode etc. */ }
    },
    remove(key) {
      try { getStorage().removeItem(key); } catch { /* ignore */ }
    },
  };
}
export const session = makeStore(() => window.sessionStorage);
export const local = makeStore(() => window.localStorage);

// ---- the sky ------------------------------------------------------------------------
// Soft, wispy waves of light drifting across a blue gradient. Each wave is one
// glowing edge with a faint translucent sheet on one side of it, so where waves
// overlap, the sheets stack into lighter bands that keep changing shape as the
// waves slide past each other at different speeds and directions.
//
// Each wave is an SVG twice as wide as the screen, and its curve repeats exactly
// halfway across, so sliding it by half its width loops with no seam. Its blur is
// drawn once; the animation only moves it, so it stays smooth on phones. Themes
// recolor the scene (style.css).

export const THEMES = ['lobby', 'choice', 'free', 'scores', 'mint', 'good', 'bad', 'hatch', 'night'];

const rand = (min, max) => min + Math.random() * (max - min);
const TAU = Math.PI * 2;

// The waves, top to bottom, on a 1000-tall canvas. `glow` is the side the glow and
// sheet are on. `y` is where the wave sits, `a` and `b` how much it swells (a big
// swell plus a smaller ripple), `time` how many seconds one loop takes, `rev` moves
// it right instead of left, and `bob` is how long it takes to rise and fall.
const WAVES = [
  { glow: 'down', y: 170, a: 85, b: 22, time: 56, rev: false, bob: 11 },
  { glow: 'up', y: 330, a: 70, b: 30, time: 42, rev: true, bob: 14 },
  { glow: 'down', y: 470, a: 95, b: 24, time: 48, rev: false, bob: 9 },
  { glow: 'up', y: 640, a: 80, b: 20, time: 64, rev: true, bob: 13 },
  { glow: 'down', y: 770, a: 65, b: 28, time: 38, rev: false, bob: 10 },
];

/** One wave as a full-height SVG, 3200 wide, whose curve repeats every 1600. */
function waveSvg(w, i) {
  const p1 = rand(0, TAU);
  const p2 = rand(0, TAU);
  const points = [];
  for (let x = 0; x <= 3200; x += 20) {
    const y = w.y + w.a * Math.sin((TAU * x) / 1600 + p1) + w.b * Math.sin((TAU * x) / 800 + p2);
    points.push(`${x} ${y.toFixed(1)}`);
  }
  const edge = `M ${points.join(' L ')}`;
  const far = w.glow === 'down' ? 1300 : -300; // the sheet runs well off screen, so bobbing never shows its end
  const sheet = `${edge} L 3200 ${far} L 0 ${far} Z`;
  // The edge brightens and fades along its length (repeating every 1600, so it loops too).
  const dim = rand(0.15, 0.35).toFixed(2);
  const shine = [[0, dim], [rand(0.15, 0.35), 1], [rand(0.45, 0.6), rand(0.2, 0.45)], [rand(0.7, 0.85), rand(0.75, 1)], [1, dim]]
    .map(([at, o]) => `<stop offset="${(+at).toFixed(2)}" stop-color="#effaff" stop-opacity="${(+o).toFixed(2)}"/>`).join('');
  const region = 'filterUnits="userSpaceOnUse" x="-200" y="-400" width="3600" height="1800"';

  return `<svg class="wave${w.rev ? ' rev' : ''}" style="--wt:${w.time}s; --wb:${w.bob}s" viewBox="0 0 3200 1000" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="wShine${i}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1600" y2="0" spreadMethod="repeat">${shine}</linearGradient>
      <clipPath id="wSide${i}"><path d="${sheet}"/></clipPath>
      <filter id="wGlow${i}" ${region}><feGaussianBlur stdDeviation="22"/></filter>
      <filter id="wSoft${i}" ${region}><feGaussianBlur stdDeviation="2"/></filter>
    </defs>
    <path d="${sheet}" fill="#fff" opacity="${w.glow === 'down' ? 0.022 : 0.015}"/>
    <g clip-path="url(#wSide${i})"><path d="${edge}" fill="none" stroke="url(#wShine${i})" stroke-width="120" opacity=".18" filter="url(#wGlow${i})"/></g>
    <path d="${edge}" fill="none" stroke="url(#wShine${i})" stroke-width="6" opacity=".2" filter="url(#wSoft${i})"/>
    <path d="${edge}" fill="none" stroke="url(#wShine${i})" stroke-width="1.6" opacity=".32" filter="url(#wSoft${i})"/>
  </svg>`;
}

/** The sky behind the game. Added once per page. */
function addScenery() {
  const scenery = document.createElement('div');
  scenery.className = 'scenery';
  scenery.innerHTML = WAVES.map(waveSvg).join('');
  document.body.prepend(scenery);

  watchHueHold();
}

// ---- hold the background to shift its colors ---------------------------------------
// Pressing and holding anywhere on the background (not on a card, button, text and
// so on) turns the whole scene's hue for as long as you hold. The turn is saved on
// the device and adds to whichever theme the game is showing.

const HUE_SPEED = 60; // degrees per second: a full trip around the colors in 6 seconds
const HOLD_DELAY = 180; // ms before it starts, so a quick tap or click changes nothing
const UI = 'button, a, input, textarea, select, label, canvas, video, img, svg, [contenteditable], [role="button"]';

const isClear = (color) => color === 'transparent' || /rgba\(.*,\s*0\)$/.test(color);

/** True if `el` is empty background: it and everything around it are plain, see-through layout boxes. */
function isBackground(el) {
  for (; el; el = el.parentElement) {
    if (el === document.body || el === document.documentElement) return true;
    if (el.matches(UI)) return false;
    const s = getComputedStyle(el);
    const bordered = ['Top', 'Right', 'Bottom', 'Left'].some((side) => s[`border${side}Style`] !== 'none' && parseFloat(s[`border${side}Width`]) > 0);
    if (s.backgroundImage !== 'none' || !isClear(s.backgroundColor) || bordered
        || (s.backdropFilter && s.backdropFilter !== 'none') || s.cursor === 'pointer') return false;
    if ([...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim())) return false;
  }
  return false;
}

function watchHueHold() {
  let hue = Number(local.get('bgHue')) || 0;
  let pointer = null;
  let timer = 0;
  let frame = 0;
  let last = 0;
  const apply = () => document.body.style.setProperty('--bg-hue', `${hue.toFixed(1)}deg`);
  apply();

  const tick = (now) => {
    hue = (hue + (Math.max(0, now - last) / 1000) * HUE_SPEED) % 360;
    last = now;
    apply();
    frame = requestAnimationFrame(tick);
  };
  const stop = () => {
    clearTimeout(timer);
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
      local.set('bgHue', Math.round(hue));
    }
    document.body.classList.remove('hue-spin');
    pointer = null;
  };

  addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || e.button !== 0 || !isBackground(e.target)) return;
    stop();
    pointer = e.pointerId;
    timer = setTimeout(() => {
      document.body.classList.add('hue-spin');
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }, HOLD_DELAY);
  });
  // letting go, or a touch that turns into a scroll, ends it
  for (const type of ['pointerup', 'pointercancel']) addEventListener(type, (e) => { if (e.pointerId === pointer) stop(); });
  addEventListener('blur', stop);
  addEventListener('contextmenu', (e) => { if (pointer !== null) e.preventDefault(); });
}

let currentTheme = null;
let activeLayer = 0;

/** Blends the sky to a theme from THEMES. */
export function setTheme(name) {
  if (name === currentTheme) return;
  if (!currentTheme) addScenery();
  currentTheme = name;
  const theme = THEMES.includes(name) ? name : 'lobby';
  const layers = document.querySelectorAll('.bg-layer');
  activeLayer ^= 1;
  layers[activeLayer].dataset.theme = theme;
  layers[activeLayer].classList.add('active');
  layers[activeLayer ^ 1].classList.remove('active');
  document.body.dataset.theme = theme;
}

// ---- countdown ---------------------------------------------------------------

let deadline = 0;
let total = 1;

/** Call on every state update; [data-countdown] and [data-timer-fill] follow along. */
export function setCountdown(remainingMs, totalMs) {
  deadline = performance.now() + remainingMs;
  total = totalMs || 1;
}

function tick() {
  const left = Math.max(0, deadline - performance.now());
  for (const el of document.querySelectorAll('[data-countdown]')) el.textContent = Math.ceil(left / 1000);
  for (const el of document.querySelectorAll('[data-timer-fill]')) {
    el.style.transform = `scaleX(${left / total})`;
    el.classList.toggle('urgent', left < 5000);
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/** Shows a "reconnecting" banner while the socket is down. */
export function watchConnection(socket) {
  const banner = document.createElement('div');
  banner.className = 'conn-banner';
  banner.textContent = 'Reconnecting…';
  document.body.append(banner);
  socket.on('disconnect', () => banner.classList.add('show'));
  socket.on('connect', () => banner.classList.remove('show'));
}
