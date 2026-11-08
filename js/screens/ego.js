// Ego Check on the host screen: the question, who's still answering or guessing,
// and the reveal of everyone's answers. s.game is the screenView() from server/games/ego.js.
import { esc, avatar, fmt } from '../common.js';
import { byId, patchWaiting, roundIntro, scoreboard, timer, waiting } from './common.js';

/** Option color: green Yes / red No, or the usual option colors. */
const optColor = (g, i) => (g.round.type === 'yesno' ? (i === 0 ? 'var(--good)' : 'var(--bad)') : `var(--opt-${i})`);
const chip = (g, i) => `<span class="ego-chip" style="background:${optColor(g, i)}">${esc(g.question.options[i])}</span>`;

/** What the guessing is about this question. */
function spotlightLabel(g) {
  if (g.round.type === 'yesno') return `said ${chip(g, 0)}`;
  if (g.round.type === 'trivia') return 'got it <b>right</b>';
  return `picked ${chip(g, g.spotlight)}`;
}

const head = (g) => `
  <div class="hs-top">
    <span class="pill">${esc(g.round.title)} · Question ${g.question.number}/${g.question.total}</span>
    <span class="pill">${esc(g.round.subtitle)}</span>
  </div>`;

const SCREENS = {
  roundIntro: (s, g) => roundIntro(g.round),

  answer: (s, g) => `
    ${head(g)}
    <div class="card hs-prompt pop">${esc(g.question.prompt)}</div>
    ${timer()}
    <div class="hs-ego-options">${g.question.options.map((opt, i) => `
      <div class="option card rise d${i + 1}" style="background:${optColor(g, i)}">${esc(opt)}</div>`).join('')}
    </div>
    <p class="hs-say on-bg">Answer on your phone!</p>
    ${waiting()}`,

  guess: (s, g) => `
    ${head(g)}
    <div class="card hs-prompt">${esc(g.question.prompt)}</div>
    ${g.round.type === 'trivia' ? `<p class="hs-say on-bg">The answer: ${chip(g, g.spotlight)}</p>` : ''}
    ${timer()}
    <h1 class="outline-text hs-huge hs-ego-ask pop">Who ${spotlightLabel(g)}?</h1>
    <p class="hs-say on-bg">Check them off on your phone!</p>
    ${waiting()}`,

  reveal: (s, g) => {
    const players = byId(s);
    return `
      ${head(g)}
      <div class="card hs-prompt small">${esc(g.question.prompt)} <span class="hs-ego-who">Who ${spotlightLabel(g)}?</span></div>
      <div class="hs-ego-rows">${g.reveal.results.filter((r) => players.has(r.playerId)).map((r, i) => {
        const p = players.get(r.playerId);
        return `
          <div class="card ego-row rise ${r.fits ? 'fits' : ''}" style="animation-delay:${0.2 + i * 0.1}s">
            ${avatar(p, 'small')}<span class="name">${esc(p.name)}</span>
            ${r.answer === null ? '<span class="ego-chip none">—</span>' : chip(g, r.answer)}
            <span class="hs-read">${r.readTries ? `${r.readRight}/${r.readTries} read right` : ''}</span>
            <b class="hs-gain">${r.points ? `+${fmt(r.points)}` : ''}</b>
          </div>`;
      }).join('')}
      </div>`;
  },

  scores: (s, g) => scoreboard(s, g.standings),
};

const THEME = { yesno: 'choice', trivia: 'free', pick: 'mint' };

export default {
  id: 'ego',

  theme(s) {
    const g = s.game;
    if (g.phase === 'reveal') return 'good';
    if (g.phase === 'scores') return 'scores';
    return THEME[g.round?.type] ?? 'lobby';
  },

  key: (s) => [s.game.phase, s.game.round?.number, s.game.question?.number].join(':'),

  render: (s) => SCREENS[s.game.phase](s, s.game),

  timer: (s) => [s.game.remainingMs, s.game.timeMs],

  patch(s) {
    const g = s.game;
    if (g.phase === 'answer') patchWaiting(s, g.answered);
    // Only players who answered get guessed about; everyone connected guesses.
    if (g.phase === 'guess') patchWaiting(s, g.guessed);
  },
};
