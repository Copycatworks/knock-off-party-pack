// Trivia on the host screen: the question and options, then who got it right.
// s.game is the screenView() from server/games/trivia.js.
import { esc, avatar, fmt } from '../common.js';
import { byId, patchWaiting, scoreboard, timer, waiting } from './common.js';

const INTRO = {
  choice: 'Pick the right answer on your phone. Faster = more points!',
  free: 'Type the answer on your phone. Worth double points!',
};

const head = (g) => `
  <div class="hs-top">
    <span class="pill">${esc(g.round.title)} · Question ${g.question.number}/${g.question.total}</span>
    <span class="pill">${esc(g.round.subtitle)}</span>
  </div>`;

const SCREENS = {
  roundIntro: (s, g) => `
    <div class="hs-intro">
      <div class="pill round-tag pop">${esc(g.round.title)} of ${g.round.total}</div>
      <h1 class="outline-text mega pop d2">${esc(g.round.subtitle)}</h1>
      <div class="card rise d4">${INTRO[g.round.type]}</div>
    </div>`,

  question: (s, g) => {
    const q = g.question;
    return `
      ${head(g)}
      <div class="card prompt hs-math pop">${esc(q.prompt)}</div>
      ${timer()}
      ${q.type === 'choice' ? `
        <div class="hs-options">${q.options.map((opt, i) => `
          <div class="option card rise d${i + 1}" style="background:var(--opt-${i})">
            <span class="option-letter">${'ABCD'[i]}</span>${esc(opt)}
          </div>`).join('')}
        </div>` : '<p class="hs-say on-bg rise">Type your answer on your phone!</p>'}
      ${waiting()}`;
  },

  reveal: (s, g) => {
    const q = g.question;
    const players = byId(s);
    const results = g.reveal.results;
    const body = q.type === 'choice' ? `
      <div class="hs-options">${q.options.map((opt, i) => {
        const pickers = results.filter((r) => r.answer === i).map((r) => players.get(r.playerId)).filter(Boolean);
        return `
          <div class="option card ${i === g.reveal.correctIndex ? 'right' : 'wrong'}" style="background:var(--opt-${i})">
            <span class="option-letter">${'ABCD'[i]}</span>${esc(opt)}
            <span class="pickers">${pickers.map((p) => avatar(p, 'small')).join('')}</span>
          </div>`;
      }).join('')}
      </div>` : `
      <div class="hs-free">${results.map((r, i) => {
        const p = players.get(r.playerId);
        if (!p) return '';
        return `
          <div class="card free-answer rise ${r.correct ? 'right' : 'wrong'}" style="animation-delay:${0.2 + i * 0.08}s">
            ${avatar(p, 'small')}<span class="name">${esc(p.name)}</span>
            <span class="said">${r.answer === null ? '—' : esc(r.answer)}</span>
            <span class="gain">${r.correct ? `+${fmt(r.points)}` : '✗'}</span>
          </div>`;
      }).join('')}
      </div>`;
    return `
      ${head(g)}
      <div class="card prompt hs-math">${esc(q.prompt)} = <span class="reveal-answer">${esc(g.reveal.answer)}</span></div>
      ${body}`;
  },

  scores: (s, g) => scoreboard(s, g.standings),
};

export default {
  id: 'trivia',

  theme(s) {
    const g = s.game;
    if (g.phase === 'reveal') return 'good';
    if (g.phase === 'scores') return 'scores';
    return g.round?.type ?? 'lobby';
  },

  key: (s) => [s.game.phase, s.game.round?.number, s.game.question?.number].join(':'),

  render: (s) => SCREENS[s.game.phase](s, s.game),

  timer: (s) => [s.game.remainingMs, s.game.round?.timeMs],

  patch(s) {
    if (s.game.phase === 'question') patchWaiting(s, s.game.answered);
  },
};
