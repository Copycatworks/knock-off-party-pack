// Pieces the host screens share: the timer, the "who's done" row, round intros
// and the between-rounds scoreboard.
import { $, esc, avatar, leaderboard } from '../common.js';

export const byId = (s) => new Map(s.players.map((p) => [p.id, p]));

export const timer = () => `
  <div class="timer">
    <div class="timer-bar"><div class="timer-fill" data-timer-fill></div></div>
    <div class="timer-num" data-countdown></div>
  </div>`;

/** A row of every player's pet that patchWaiting() marks as they finish. */
export const waiting = () => '<div id="hs-waiting" class="hs-waiting"></div>';

export function patchWaiting(s, doneIds, onlyIds = null) {
  const el = $('#hs-waiting');
  if (!el) return;
  const done = new Set(doneIds);
  const only = onlyIds && new Set(onlyIds);
  el.innerHTML = s.players.filter((p) => !only || only.has(p.id)).map((p) => `
    <div class="strip-player ${done.has(p.id) ? 'done' : 'waiting'} ${p.connected ? '' : 'offline'}">
      ${avatar(p, 'small')}${done.has(p.id) ? '<span class="badge">✓</span>' : ''}
    </div>`).join('');
}

export const roundIntro = (round) => `
  <div class="hs-intro">
    <div class="pill round-tag pop">${esc(round.title)} of ${round.total}</div>
    <h1 class="outline-text mega pop d2">${esc(round.subtitle)}</h1>
    <div class="card rise d4">${esc(round.intro)}</div>
  </div>`;

export const scoreboard = (s, standings) => `
  <div class="hs-scores">
    <h1 class="outline-text mega pop">Scores so far</h1>
    ${leaderboard(standings, s.players)}
  </div>`;
