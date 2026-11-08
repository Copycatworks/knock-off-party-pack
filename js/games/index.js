import draw from './draw.js';
import ego from './ego.js';
import match from './match.js';
import trivia from './trivia.js';

/*
 * Phone UI for each game, keyed by the same id as server/games/. A module exports:
 *
 *   theme(s)                       background theme name from THEMES in common.js
 *   key(s)                         string; the screen is rebuilt only when it changes
 *   render(s)                      HTML for the screen
 *   patch(s, send)                 optional: update live bits without a rebuild (send as below)
 *   timer(s)                       optional: [remainingMs, totalMs] for the countdown
 *   onClick(action, el, send, app) optional: a click on a [data-action] element
 *   onSubmit(form, send)           optional: a form submit
 *
 * `s` is the room state (s.game is the game's own view); send(data) emits 'game:input'.
 * Set `header: false` to hide the name/score bar at the top of the screen.
 */
export const GAME_UI = Object.fromEntries([trivia, match, ego, draw].map((g) => [g.id, g]));
