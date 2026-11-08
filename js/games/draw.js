// Memory Draw on a phone: tick the characters you know, the drawing pad, then
// letter buttons to vote on the drawings shown on the host screen (js/screens/draw.js).
// `s.game` is the view from js/server/games/draw.js.
import { $, esc, fmt, ordinal } from '../common.js';
import { INK, SIZES, paintDrawing, paintStroke } from '../drawing.js';

const byId = (s) => new Map(s.players.map((p) => [p.id, p]));
const LETTERS = 'ABCDEFGH';

// ---- the drawing pad ------------------------------------------------------------
// Lives outside the screen HTML so a rebuild (or reconnect) keeps your strokes.
// Every finished stroke is sent to the server, so time running out keeps it too.

let pad = { key: null, strokes: [], undo: [], color: 0, size: 1 };

function setupPad(s, send) {
  const canvas = $('#draw-canvas');
  if (!canvas || canvas.dataset.ready) return;
  canvas.dataset.ready = '1';
  const key = `${s.code}:${s.game.round.number}`;
  if (pad.key !== key) pad = { key, strokes: s.game.myDrawing ?? [], undo: [], color: 0, size: 1 };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = canvas.height = Math.round(canvas.clientWidth * dpr);
  const ctx = canvas.getContext('2d');
  const scale = canvas.width / 1000;
  paintDrawing(canvas, pad.strokes);
  markTools();

  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * 1000), Math.round(((e.clientY - r.top) / r.height) * 1000)];
  };
  let current = null;
  canvas.addEventListener('pointerdown', (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* keep drawing without capture */ }
    pad.undo.push(pad.strokes.slice());
    current = { c: pad.color, w: pad.size, p: point(e) };
    pad.strokes.push(current);
    paintStroke(ctx, current, scale);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!current) return;
    const merged = e.getCoalescedEvents?.() ?? [];
    for (const ev of merged.length ? merged : [e]) {
      const [x, y] = point(ev);
      const p = current.p;
      if (Math.hypot(x - p.at(-2), y - p.at(-1)) < 4) continue; // skip tiny moves to keep drawings small
      p.push(Math.min(1000, Math.max(0, x)), Math.min(1000, Math.max(0, y)));
      paintStroke(ctx, current, scale, p.length - 2);
    }
  });
  const end = () => {
    if (!current) return;
    current = null;
    send({ type: 'drawing', strokes: pad.strokes });
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  pad.redraw = () => paintDrawing(canvas, pad.strokes);
}

function markTools() {
  document.querySelectorAll('[data-action="draw-color"]').forEach((b) => b.classList.toggle('on', Number(b.dataset.i) === pad.color));
  document.querySelectorAll('[data-action="draw-size"]').forEach((b) => b.classList.toggle('on', Number(b.dataset.i) === pad.size));
}

/** Shows your finished drawing while you wait for everyone else. */
function paintMine() {
  const canvas = document.querySelector('canvas[data-art="mine"]:not([data-painted])');
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = canvas.height = Math.round(canvas.clientWidth * dpr);
  paintDrawing(canvas, pad.strokes);
  canvas.dataset.painted = '1';
}

// ---- screens -------------------------------------------------------------------------

const head = (left, right) => `
  <div class="status-line">
    <span class="pill">${left}</span>
    <span class="pill">${right}</span>
  </div>`;

const lookUp = (text) => `<div class="card panel center rise"><p class="big-msg">👀 Look at the screen!</p>${text ? `<p class="sub-msg">${text}</p>` : ''}</div>`;

/** "vs ANNA" in head to head, or "Everyone draws this". */
function versus(s, g) {
  const players = byId(s);
  return g.round.headToHead
    ? `vs ${g.opponents.map((id) => esc(players.get(id)?.name ?? '?')).join(' & ')}`
    : 'Everyone draws this';
}

/** The lock-in button's label and state, from how many characters are ticked. */
function updatePickButton(form, need) {
  const button = form?.querySelector('[type="submit"]');
  if (!button) return;
  const left = need - form.querySelectorAll('.check-row.on').length;
  button.disabled = left > 0;
  button.textContent = left > 0 ? `Tick ${left} more` : 'Lock in';
}

const SCREENS = {
  roundIntro: (s, g) => `
    <div class="center-stack">
      <div class="pill round-tag pop">${esc(g.round.title)}</div>
      <h1 class="outline-text mega pop d2">${esc(g.round.subtitle)}</h1>
    </div>
    ${lookUp(esc(g.round.intro))}`,

  // Tick the characters you could draw (at least round.need of them).
  pick: (s, g) => `
    ${head(`${versus(s, g)} · <span data-countdown></span>`, '🤫 Secret')}
    ${g.myPicks ? `
      <div class="card panel center locked rise">
        <p class="big-msg">Locked in!</p>
        <p class="sub-msg">You'll draw the one your ${g.round.headToHead ? 'matchup' : 'group'} knows best. Waiting for everyone else…</p>
      </div>` : `
      <form class="card panel dr-choose rise" id="pick-form" data-need="${g.round.need}">
        <p class="ego-ask">Which of these could you draw from memory? Tick at least ${g.round.need}.</p>
        <div class="check-list">${g.options.map((name, i) => `
          <button type="button" class="check-row" data-action="draw-pick" data-i="${i}" aria-pressed="false">
            <span class="name">${esc(name)}</span><span class="box"></span>
          </button>`).join('')}
        </div>
        <button class="btn go wide" type="submit" disabled>Tick ${g.round.need} more</button>
      </form>`}`,

  draw: (s, g) => {
    const vs = versus(s, g);
    const done = g.done.includes(s.you.id);
    return `
      ${head(`${vs} · <span data-countdown></span>`, '🤫 Secret')}
      <div class="card dr-prompt"><span class="label">Draw from memory</span><b>${esc(g.prompt)}</b></div>
      ${done ? `
        <div class="dr-pad done"><canvas class="dr-canvas" data-art="mine"></canvas></div>
        <div class="card panel center locked rise"><p class="big-msg">Done!</p><p class="sub-msg">Waiting for everyone else…</p></div>` : `
        <div class="dr-pad"><canvas id="draw-canvas" class="dr-canvas"></canvas></div>
        <div class="dr-tools">
          <div class="dr-colors">${INK.map((c, i) => `<button class="dr-color" style="--sw:${c}" data-action="draw-color" data-i="${i}" aria-label="Color ${i + 1}"></button>`).join('')}</div>
          <div class="dr-row">
            ${SIZES.map((w, i) => `<button class="dr-size" data-action="draw-size" data-i="${i}" aria-label="Brush ${i + 1}"><span style="--d:${6 + i * 7}px"></span></button>`).join('')}
            <button class="btn small" data-action="draw-undo">↶ Undo</button>
            <button class="btn small" data-action="draw-clear">Clear</button>
          </div>
        </div>
        <button class="btn go wide" data-action="draw-done">I'm done!</button>`}`;
  },

  vote: (s, g) => {
    const m = g.matchup;
    const voted = g.myVote !== null;
    const note = !g.canVote ? 'You’re in this one! Everyone else is voting.'
      : voted ? 'Vote locked in! Keep handing out 👍s.' : 'Which drawing on the screen is closest?';
    return `
      ${head(g.round.headToHead ? `Matchup ${m.number}/${m.total}` : esc(g.round.title), '<span data-countdown></span>')}
      <div class="card dr-prompt"><span class="label">${note}</span><span>Who drew <b>${esc(m.prompt)}</b> ${g.round.headToHead ? 'better' : 'best'}?</span></div>
      <div class="dr-ballot">${m.entries.map((e, i) => `
        <div class="card dr-pick ${g.myVote === i ? 'picked' : ''} ${e.mine ? 'mine' : ''}">
          <span class="dr-big-letter">${LETTERS[i]}</span>
          ${e.mine ? '<span class="dr-yours">Yours</span>' : `
            ${g.canVote ? `<button class="btn go dr-vote" data-action="draw-vote" data-i="${i}" ${voted ? 'disabled' : ''}>${g.myVote === i ? '✓ Voted' : 'Vote'}</button>` : ''}
            <button class="btn dr-like" data-action="draw-like" data-i="${i}" aria-pressed="false">👍</button>`}
        </div>`).join('')}
      </div>`;
  },

  result: (s, g) => {
    const mine = g.matchup.result.find((r) => r.playerId === s.you.id);
    return mine ? `
      <div class="center-stack">
        <h1 class="outline-text mega pop">${mine.winner ? 'You won it!' : `+${fmt(mine.points)}`}</h1>
        <p class="big-msg rise d2">🗳️ ${mine.voters.length} · 👍 ${mine.likes}${mine.winner ? ` · +${fmt(mine.points)}` : ''}</p>
      </div>
      ${lookUp('')}` : lookUp('Here’s who drew what!');
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
  id: 'draw',

  theme(s) {
    const g = s.game;
    if (g.phase === 'pick') return 'mint';
    if (g.phase === 'draw') return 'choice';
    if (g.phase === 'vote') return 'free';
    if (g.phase === 'result') return g.matchup.result.find((r) => r.playerId === s.you.id)?.winner ? 'good' : 'scores';
    if (g.phase === 'scores') return 'scores';
    return 'lobby';
  },

  // The screen is rebuilt only when this changes, so the drawing pad survives updates.
  key: (s) => [s.game.phase, s.game.round?.number, s.game.matchup?.number, s.game.done.includes(s.you.id), s.game.myVote, !!s.game.myPicks].join(':'),

  render: (s) => SCREENS[s.game.phase](s, s.game),

  timer: (s) => [s.game.remainingMs, s.game.timeMs],

  patch(s, send) {
    const g = s.game;
    if (g.phase === 'draw') setupPad(s, send);
    paintMine();
    document.querySelectorAll('[data-action="draw-like"]').forEach((b) => {
      const on = g.myLikes.includes(Number(b.dataset.i));
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  },

  onSubmit(form, send) {
    if (form.id !== 'pick-form') return;
    const picks = [...form.querySelectorAll('.check-row.on')].map((b) => Number(b.dataset.i));
    if (picks.length < Number(form.dataset.need)) return;
    form.querySelector('[type="submit"]').disabled = true;
    send({ type: 'pick', picks });
  },

  onClick(action, el, send) {
    const i = Number(el.dataset.i);
    if (action === 'draw-pick') {
      el.setAttribute('aria-pressed', String(el.classList.toggle('on')));
      const form = el.closest('form');
      updatePickButton(form, Number(form.dataset.need));
    } else if (action === 'draw-color') { pad.color = i; markTools(); }
    else if (action === 'draw-size') { pad.size = i; markTools(); }
    else if (action === 'draw-undo') {
      if (!pad.undo.length) return;
      pad.strokes = pad.undo.pop();
      pad.redraw?.();
      send({ type: 'drawing', strokes: pad.strokes });
    } else if (action === 'draw-clear') {
      if (!pad.strokes.length) return;
      pad.undo.push(pad.strokes);
      pad.strokes = [];
      pad.redraw?.();
      send({ type: 'drawing', strokes: pad.strokes });
    } else if (action === 'draw-done') {
      el.disabled = true;
      send({ type: 'done', strokes: pad.strokes });
    } else if (action === 'draw-vote') {
      document.querySelectorAll('[data-action="draw-vote"]').forEach((b) => (b.disabled = true));
      send({ type: 'vote', entry: i });
    } else if (action === 'draw-like') {
      send({ type: 'like', entry: i, on: !el.classList.contains('on') });
    }
  },
};
