// Ego Check on a phone: your answer buttons, the checklist of who you think fits,
// and how you did. The question, timer and full reveal are on the host screen
// (public/js/screens/ego.js). `s.game` is the view from server/games/ego.js.
import { esc, avatar, fmt, ordinal } from '../common.js';

const byId = (s) => new Map(s.players.map((p) => [p.id, p]));
const myResult = (s) => s.game.reveal?.results.find((r) => r.playerId === s.you.id);

/** Button color for option `i`: green Yes / red No, or the usual option colors. */
const optColor = (g, i) => (g.round.type === 'yesno' ? (i === 0 ? 'var(--good)' : 'var(--bad)') : `var(--opt-${i})`);

/** What the checkboxes mean this question. */
function spotlightLabel(g) {
  if (g.round.type === 'yesno') return 'said <b>YES</b>';
  if (g.round.type === 'trivia') return 'got it <b>right</b>';
  // The option in the same color as its button.
  return `picked <span class="ego-chip" style="background:${optColor(g, g.spotlight)}">${esc(g.question.options[g.spotlight])}</span>`;
}

const head = (g) => `
  <div class="status-line">
    <span class="pill">${esc(g.round.subtitle)} · Q${g.question.number}/${g.question.total}</span>
    <span class="pill" data-countdown></span>
  </div>`;

const lookUp = (text) => `<div class="card panel center rise"><p class="big-msg">👀 Look at the screen!</p>${text ? `<p class="sub-msg">${text}</p>` : ''}</div>`;

const SCREENS = {
  roundIntro: (s, g) => `
    <div class="center-stack">
      <div class="pill round-tag pop">${esc(g.round.title)}</div>
      <h1 class="outline-text mega pop d2">${esc(g.round.subtitle)}</h1>
    </div>
    ${lookUp(esc(g.round.intro))}`,

  answer: (s, g) => {
    const q = g.question;
    const body = g.answer !== null ? `
      <div class="card panel center locked rise">
        <p class="big-msg">Locked in!</p>
        <span class="answer" style="background:${optColor(g, g.answer)}">${esc(q.options[g.answer])}</span>
        <p class="sub-msg">Waiting for everyone else…</p>
      </div>` : `
      <div class="choices ${g.round.type === 'yesno' ? 'ego-yesno' : ''}">${q.options.map((opt, i) => `
        <button class="btn choice rise d${i + 1}" style="background:${optColor(g, i)}" data-action="ego-answer" data-index="${i}">${esc(opt)}</button>`).join('')}
      </div>`;
    return `
      ${head(g)}
      <div class="card prompt ego-prompt pop">${esc(q.prompt)}</div>
      ${body}`;
  },

  guess: (s, g) => {
    const q = g.question;
    const players = byId(s);
    const answer = g.round.type === 'trivia'
      ? `<p class="ego-key">Answer: <span class="ego-chip" style="background:var(--good)">${esc(q.options[g.spotlight])}</span></p>` : '';
    let body;
    if (!g.targets.length) {
      body = '<div class="card panel center"><p class="big-msg">Nobody to guess about</p><p class="sub-msg">Hang tight…</p></div>';
    } else if (g.checked !== null) {
      body = `
        <div class="card panel center locked rise">
          <p class="big-msg">Guesses locked in!</p>
          <p class="sub-msg">Waiting for everyone else…</p>
        </div>`;
    } else {
      body = `
        <form class="card panel ego-guess rise" id="guess-form">
          <p class="ego-ask">Check everyone who ${spotlightLabel(g)}</p>
          <div class="check-list">${g.targets.map((id) => players.get(id)).filter(Boolean).map((p) => `
            <button type="button" class="check-row" data-action="ego-toggle" data-id="${p.id}" aria-pressed="false">
              ${avatar(p, 'tiny')}<span class="name">${esc(p.name)}</span><span class="box"></span>
            </button>`).join('')}
          </div>
          <button class="btn go wide" type="submit">Lock in guesses</button>
        </form>`;
    }
    return `
      ${head(g)}
      <div class="card prompt ego-prompt small">${esc(q.prompt)}</div>
      ${answer}
      ${body}`;
  },

  reveal: (s, g) => {
    const q = g.question;
    const players = byId(s);
    const mine = myResult(s);
    const checked = new Set(g.checked ?? []);
    const targets = new Set(g.targets);
    const guessedAny = g.checked !== null;
    // How your guesses went, one row per player you guessed about.
    const rows = g.reveal.results.filter((r) => players.has(r.playerId) && targets.has(r.playerId)).map((r, i) => {
      const p = players.get(r.playerId);
      const mark = !guessedAny ? '<span class="ego-mark miss">—</span>'
        : checked.has(r.playerId) === r.fits ? '<span class="ego-mark right">✓</span>' : '<span class="ego-mark wrong">✗</span>';
      return `
        <div class="card ego-row rise ${r.fits ? 'fits' : ''}" style="animation-delay:${0.2 + i * 0.08}s">
          ${avatar(p, 'tiny')}<span class="name">${esc(p.name)}</span>
          ${r.answer === null ? '<span class="ego-chip none">—</span>'
            : `<span class="ego-chip" style="background:${optColor(g, r.answer)}">${esc(q.options[r.answer])}</span>`}
          ${mark}
        </div>`;
    }).join('');
    const read = mine?.readTries ? `<p class="sub-msg ego-read">${mine.readRight} of ${mine.readTries} read you right</p>` : '';
    return `
      <div class="verdict-row pop">
        <span class="outline-text verdict">${mine?.points ? `+${fmt(mine.points)}` : 'No points'}</span>
      </div>
      ${read}
      ${rows ? `
        <p class="ego-ask on-bg">Who ${spotlightLabel(g)}? <span class="ego-legend">✓ = you guessed right</span></p>
        <div class="ego-rows">${rows}</div>` : lookUp('')}`;
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

const THEME = { yesno: 'choice', trivia: 'free', pick: 'mint' };

export default {
  id: 'ego',

  theme(s) {
    const g = s.game;
    if (g.phase === 'reveal') return myResult(s)?.points ? 'good' : 'bad';
    if (g.phase === 'scores') return 'scores';
    return THEME[g.round?.type] ?? 'lobby';
  },

  // The screen is rebuilt only when this changes; checkboxes live in the DOM until then.
  key: (s) => [s.game.phase, s.game.round?.number, s.game.question?.number, s.game.answer !== null, s.game.checked !== null].join(':'),

  render: (s) => SCREENS[s.game.phase](s, s.game),

  timer: (s) => [s.game.remainingMs, s.game.timeMs],

  onClick(action, el, send, app) {
    if (action === 'ego-answer') {
      app.querySelectorAll('[data-action="ego-answer"]').forEach((b) => (b.disabled = true));
      send({ type: 'answer', answer: Number(el.dataset.index) });
    } else if (action === 'ego-toggle') {
      const on = el.classList.toggle('on');
      el.setAttribute('aria-pressed', String(on));
    }
  },

  onSubmit(form, send) {
    if (form.id !== 'guess-form') return;
    form.querySelector('[type="submit"]').disabled = true;
    send({ type: 'guess', checked: [...form.querySelectorAll('.check-row.on')].map((b) => b.dataset.id) });
  },
};
