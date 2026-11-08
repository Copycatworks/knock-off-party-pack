import draw from './draw.js';
import ego from './ego.js';
import match from './match.js';
import trivia from './trivia.js';

/*
 * Host screen UI for each game, keyed by the same id as server/games/. The
 * host screen shows the shared parts of a game (prompts, timers, reveals,
 * scores); players' phones have the controls (public/js/games/). A module exports:
 *
 *   theme(s)    background theme name from THEMES in common.js
 *   key(s)      string; the screen is rebuilt only when it changes
 *   render(s)   HTML for the screen
 *   patch(s)    optional: update live bits without a rebuild
 *   timer(s)    optional: [remainingMs, totalMs] for the countdown
 *
 * `s` is the room state with s.game from the game's screenView().
 */
export const SCREEN_UI = Object.fromEntries([trivia, match, ego, draw].map((g) => [g.id, g]));
