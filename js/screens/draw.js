// Memory Draw on the host screen: who's picking and drawing, the drawings to vote
// on, and the results. s.game is the screenView() from js/server/games/draw.js.
import { esc, avatar, fmt } from '../common.js';
import { paintDrawing } from '../drawing.js';
import { byId, patchWaiting, roundIntro, scoreboard, timer, waiting } from './common.js';

const LETTERS = 'ABCDEFGH';

/** Paints every drawing canvas that hasn't been painted yet. */
function paintGallery(s) {
  const m = s.game.matchup;
  for (const canvas of document.querySelectorAll('canvas[data-art]:not([data-painted])')) {
    const strokes = (m?.entries ?? m?.result)?.[canvas.dataset.art]?.drawing;
    if (!strokes) continue;
    canvas.width = canvas.height = Math.round(canvas.clientWidth * 2);
    paintDrawing(canvas, strokes);
    canvas.dataset.painted = '1';
  }
}

const head = (g, right) => `
  <div class="hs-top">
    <span class="pill">${esc(g.round.title)}${g.matchup && g.round.headToHead ? ` · Matchup ${g.matchup.number}/${g.matchup.total}` : ''}</span>
    <span class="pill">${right}</span>
  </div>`;

const SCREENS = {
  roundIntro: (s, g) => roundIntro(g.round),

  pick: (s, g) => `
    ${head(g, 'Picking')}
    <h1 class="outline-text hs-huge pop">Which ones do you know?</h1>
    <p class="hs-say on-bg">${g.round.headToHead
      ? 'Each matchup gets its own secret characters. On your phone, tick the ones you could draw. You’ll get the one your matchup knows best!'
      : 'On your phone, tick the characters you could draw. Everyone gets the one the most of you know!'}</p>
    ${timer()}
    ${waiting()}`,

  draw: (s, g) => `
    ${head(g, 'Drawing')}
    <h1 class="outline-text hs-huge pop">Draw from memory!</h1>
    <p class="hs-say on-bg">${g.round.headToHead
      ? 'Each matchup has its own secret character. Check your phone!'
      : 'Everyone has the same character. Check your phone!'}</p>
    ${timer()}
    ${waiting()}`,

  vote: (s, g) => {
    const m = g.matchup;
    return `
      ${head(g, 'Vote on your phone')}
      <div class="card hs-prompt small">Who drew <b>${esc(m.prompt)}</b> ${g.round.headToHead ? 'better' : 'best'}?</div>
      ${timer()}
      <div class="hs-gallery n${m.entries.length}">${m.entries.map((e, i) => `
        <div class="card dr-entry hs-entry pop" style="animation-delay:${i * 0.12}s">
          <span class="dr-letter">${LETTERS[i]}</span>
          <canvas class="dr-canvas" data-art="${i}"></canvas>
        </div>`).join('')}
      </div>
      ${waiting()}`;
  },

  result: (s, g) => {
    const m = g.matchup;
    const players = byId(s);
    return `
      ${head(g, 'Results')}
      <div class="card hs-prompt small">The drawings of <b>${esc(m.prompt)}</b></div>
      <div class="hs-gallery n${m.result.length}">${m.result.map((r, i) => {
        const p = players.get(r.playerId);
        return `
          <div class="card dr-entry hs-entry rise ${r.winner ? 'winner' : ''}" style="animation-delay:${0.15 + i * 0.12}s">
            <span class="dr-letter">${LETTERS[i]}</span>
            ${r.winner ? '<span class="dr-crown">👑</span>' : ''}
            <canvas class="dr-canvas" data-art="${i}"></canvas>
            <div class="dr-artist">${p ? avatar(p, 'tiny') : ''}<span class="name">${esc(p?.name ?? '?')}</span><b class="hs-gain">+${fmt(r.points)}</b></div>
            <div class="dr-stats"><span>🗳️ ${r.voters.length}</span><span>👍 ${r.likes}</span>
              <span class="dr-voters">${r.voters.map((id) => players.get(id)).filter(Boolean).map((v) => avatar(v, 'tiny')).join('')}</span></div>
          </div>`;
      }).join('')}
      </div>`;
  },

  scores: (s, g) => scoreboard(s, g.standings),
};

export default {
  id: 'draw',

  theme(s) {
    const g = s.game;
    if (g.phase === 'pick') return 'mint';
    if (g.phase === 'draw') return 'choice';
    if (g.phase === 'vote') return 'free';
    if (g.phase === 'result') return 'good';
    if (g.phase === 'scores') return 'scores';
    return 'lobby';
  },

  key: (s) => [s.game.phase, s.game.round?.number, s.game.matchup?.number].join(':'),

  render: (s) => SCREENS[s.game.phase](s, s.game),

  timer: (s) => [s.game.remainingMs, s.game.timeMs],

  patch(s) {
    const g = s.game;
    paintGallery(s);
    if (g.phase === 'pick') patchWaiting(s, g.picked);
    if (g.phase === 'draw') patchWaiting(s, g.done);
    if (g.phase === 'vote') patchWaiting(s, g.voted, g.voters);
  },
};
