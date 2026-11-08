// How players look: a color and an ASCII face (up to 3 characters, like :) or
// \o/), picked on the phone. Shared by the server (validation) and the browser.

export const COLORS = {
  red: '#ff5a5a',
  orange: '#ff9330',
  yellow: '#ffd23f',
  lime: '#a3e635',
  green: '#3fc06a',
  mint: '#4fe0b5',
  sky: '#3fb8ff',
  blue: '#4c6ef5',
  purple: '#9061f9',
  pink: '#ff7ab6',
  rose: '#ffb3d9',
  brown: '#9a6538',
  gray: '#9a9aaa',
  charcoal: '#5b5b6e',
};

export const MAX_FACE = 3;

/** Ready-made faces: a random one is the default, and the phone offers them as ideas. */
export const FACES = [
  ':)', ':(', ':D', ':O', ':P', ':*', ';)', ':3', ':|', ':/', 'xD', 'B)', '8)', 'D:', '<3',
  '>.>', '<.<', '^_^', '-_-', 'o_O', 'T_T', '>:(', '>:)', ':^)', '\\o/', 'owo', 'uwu', '._.',
];

/** Plain keyboard characters only (printable ASCII), spaces squeezed, at most MAX_FACE. '' if nothing's left. */
export function cleanFace(raw) {
  return String(raw ?? '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_FACE);
}

export const randomFace = () => FACES[Math.floor(Math.random() * FACES.length)];

/** A look from a phone, with anything invalid replaced. */
export function cleanLook(look) {
  return {
    color: Object.hasOwn(COLORS, look?.color) ? look.color : 'sky',
    face: cleanFace(look?.face) || randomFace(),
  };
}

/** A random look, for a phone's first visit. */
export function randomLook() {
  const colors = Object.keys(COLORS);
  return { color: colors[Math.floor(Math.random() * colors.length)], face: randomFace() };
}
