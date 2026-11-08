// Trivia on a phone: the answer buttons or box, then how you did. The question
// and everyone's answers are on the host screen (public/js/screens/trivia.js).
// `s.game` is the view from server/games/trivia.js.
import { $, esc, fmt, ordinal } from '../common.js';

const myResult = (s) => s.game.reveal?.results.find((r) => r.playerId === s.you.id);
const lookUp = (text) => `<div class="card panel center rise"><p class="big-msg">👀 Look at the screen!</p>${text ? `<p class="sub-msg">${text}</p>` : ''}</div>`;

const SCREENS = {
  roundIntro: (s, g) => `
    <div class="center-stack">
      <div class="pill round-tag pop">${esc(g.round.title)}</div>
      <h1 class="outline-text mega pop d2">${esc(g.round.subtitle)}</h1>
    </div>
    ${lookUp('Get ready…')}`,

  question: (s, g) => {
    const q = g.question;
    let body;
    if (g.answer !== null) {
      const shown = q.type === 'choice' ? q.options[g.answer] : g.answer;
      const bg = q.type === 'choice' ? `var(--opt-${g.answer})` : 'var(--paper)';
      body = `
        <div class="card panel center locked rise">
          <p class="big-msg">Locked in!</p>
          <span class="answer" style="background:${bg}">${esc(shown)}</span>
          <p class="sub-msg">Waiting for everyone else…</p>
        </div>`;
    } else if (q.type === 'choice') {
      body = `
        <div class="choices">${q.options.map((opt, i) => `
          <button class="btn choice rise d${i + 1}" style="background:var(--opt-${i})" data-action="choose" data-index="${i}">
            <span class="option-letter">${'ABCD'[i]}</span>${esc(opt)}
          </button>`).join('')}
        </div>`;
    } else {
      body = `
        <form class="card panel rise d1" id="answer-form" autocomplete="off">
          <label class="label" for="answer-input">${esc(q.prompt)} = ?</label>
          <input class="input" id="answer-input" maxlength="40" spellcheck="false" placeholder="Your answer"
                 ${q.inputHint === 'number' ? 'inputmode="numeric"' : ''}>
          <button class="btn go wide" type="submit">Submit</button>
        </form>`;
    }
    return `
      <div class="status-line"><span class="pill">Question ${q.number}/${q.total}</span><span class="pill" data-countdown></span></div>
      ${body}`;
  },

  reveal: (s, g) => {
    const mine = myResult(s);
    const verdict = mine?.correct ? 'Correct!' : g.answer !== null ? 'Nope!' : 'Too slow!';
    return `
      <div class="center-stack">
        <h1 class="outline-text mega pop">${verdict}</h1>
        ${mine?.correct ? `<p class="big-msg rise d2">+${fmt(mine.points)}</p>` : ''}
      </div>
      ${lookUp('')}`;
  },

  scores: (s, g) => {
    const me = g.standings.find((st) => st.id === s.you.id);
    return `
      <div class="center-stack">
        <h1 class="outline-text mega pop">${me ? ordinal(me.rank) : ''}</h1>
        <p class="big-msg rise d2">${fmt(g.myScore)} pts</p>
      </div>
      ${lookUp('Scores so far')}`;
  },
};

export default {
  id: 'trivia',

  theme(s) {
    const g = s.game;
    if (g.phase === 'reveal') return myResult(s)?.correct ? 'good' : 'bad';
    if (g.phase === 'scores') return 'scores';
    return g.round?.type ?? 'lobby';
  },

  // The screen is rebuilt only when this changes; everything else goes through patch().
  key: (s) => [s.game.phase, s.game.round?.number, s.game.question?.number, s.game.answer !== null].join(':'),

  render: (s) => SCREENS[s.game.phase](s, s.game),

  timer: (s) => [s.game.remainingMs, s.game.round?.timeMs],

  onClick(action, el, send, app) {
    if (action !== 'choose') return;
    app.querySelectorAll('[data-action="choose"]').forEach((b) => (b.disabled = true));
    send({ type: 'answer', answer: Number(el.dataset.index) });
  },

  onSubmit(form, send) {
    if (form.id !== 'answer-form') return;
    const value = $('#answer-input').value.trim();
    if (!value) return;
    form.querySelector('button').disabled = true;
    send({ type: 'answer', answer: value });
  },
};
