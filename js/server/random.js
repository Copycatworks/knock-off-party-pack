// Fair random numbers from the browser's crypto (the game logic used to run in Node).

/** A random whole number from 0 up to (but not including) `max`, with no bias. */
export function randomInt(max) {
  const limit = Math.floor(0x100000000 / max) * max; // reject the uneven tail so every value is equally likely
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % max;
}

/** `bytes` random bytes as a hex string. */
export function randomHex(bytes) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
