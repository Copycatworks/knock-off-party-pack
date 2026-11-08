// The phone app: a controller for the game on the host screen. Pick a name, a
// color and an ASCII face, join a room, wait in the lobby (the VIP picks the game),
// play, and see how you did. While a game is running, its controls come from
// the matching module in games/.
import { $, esc, avatar, fmt, ordinal, session, local, setTheme, setCountdown, watchConnection } from './common.js';
import { GAME_UI } from './games/index.js';
import { COLORS, FACES, MAX_FACE, cleanFace, cleanLook, randomLook } from './looks.js';
import { phoneSocket } from './net.js';

const socket = phoneSocket(); // connects straight to the host screen (net.js)
const app = $('#app');
let state = null; // the room you're in, or null
let look = local.get('look') ? cleanLook(local.get('look')) : randomLook(); // your color + face
let editingLook = false;
let joinError = '';
let screenKey = '';

// One id per browser tab; lets a refreshed or reconnected phone get its seat back.
let playerId = session.get('playerId');
if (!playerId) {
  playerId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  session.set('playerId', playerId);
}

const send = (data) => socket.emit('game:input', data);

watchConnection(socket);

socket.on('connect', () => {
  const seat = session.get('seat');
  if (seat) join({ code: seat.code, name: seat.name }, true);
  else render();
});

socket.on('state', (s) => {
  state = s;
  if (s.phase !== 'lobby') editingLook = false;
  render();
});

function join(data, resuming = false) {
  socket.emit('room:join', { ...data, look, playerId }, (res) => {
    if (res.ok) {
      session.set('seat', { code: res.code, name: res.name });
      local.set('lastName', res.name);
      saveLook(res.look); // your color may have been taken, so the room picked another
      joinError = '';
      return;
    }
    session.remove('seat');
    socket.leave();
    state = null;
    joinError = resuming ? 'That game has ended. Join a new one!' : res.error;
    render();
  });
}

function saveLook(next) {
  look = cleanLook(next);
  local.set('look', look);
}

// ---- rendering -------------------------------------------------------------------

/** Rebuilds the screen only when `key` changes, so typing isn't wiped and animations don't replay. */
function show(theme, key, html) {
  setTheme(theme);
  if (key === screenKey) return false;
  screenKey = key;
  app.innerHTML = html();
  return true;
}

function render() {
  if (!state) {
    show('lobby', `join:${joinError}`, joinHtml);
    patchLook(look, new Set());
    return;
  }

  const s = state;
  const ui = s.phase === 'playing' ? GAME_UI[s.gameId] : null;
  if (s.phase === 'playing' && !(ui && s.game)) return;
  const [remaining, total] = ui?.timer?.(s) ?? [0, 1];
  setCountdown(remaining, total);

  const theme = ui ? ui.theme(s) : s.phase === 'results' ? 'scores' : 'lobby';
  const key = ui ? `game:${ui.key(s)}` : `${s.phase}:${s.isVip}:${editingLook}`;
  const body = () => (ui?.header === false ? '' : header()) + (ui ? ui.render(s) : s.phase === 'results' ? resultsHtml(s) : lobbyHtml());
  if (show(theme, key, body)) $('#answer-input')?.focus();

  patchHeader(s);
  if (s.phase === 'lobby') patchLobby(s);
  ui?.patch?.(s, send);
}

const header = () => `
  <div class="status-line">
    <span class="pill" id="me"></span>
    <span class="pill" id="right-pill"></span>
  </div>`;

function patchHeader(s) {
  if (!$('#me')) return; // the game hides the header
  const me = s.players.find((p) => p.id === s.you.id);
  if (me) $('#me').innerHTML = `${avatar(me, 'tiny')} ${esc(me.name)}${s.isVip ? ' 👑' : ''}`;
  const myScore = s.phase === 'playing' ? s.game?.myScore : undefined;
  $('#right-pill').textContent = myScore !== undefined ? `${fmt(myScore)} pts` : `Room ${s.code}`;
}

// ---- your look -------------------------------------------------------------------------
// Colors are one per player in a room; colors other players have are crossed out.

const lookPicker = () => `
  <div class="look-picker">
    <div class="label">Color</div>
    <div class="swatches">${Object.entries(COLORS).map(([key, hex]) => `
      <button type="button" class="swatch" style="--sw:${hex}" data-action="look-color" data-color="${key}" aria-label="${key}"></button>`).join('')}
    </div>
    <label class="label" for="face-input">Your face <span class="hint">up to ${MAX_FACE} characters</span></label>
    <input class="input face-input" id="face-input" maxlength="${MAX_FACE}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
    <div class="face-ideas">${FACES.map((f) => `
      <button type="button" class="face-chip" data-action="look-face" data-face="${esc(f)}">${esc(f)}</button>`).join('')}
    </div>
  </div>`;

/** Marks the picked color and face (and taken colors) without rebuilding the screen. */
function patchLook(current, taken) {
  for (const b of app.querySelectorAll('[data-action="look-color"]')) {
    b.classList.toggle('on', b.dataset.color === current.color);
    b.disabled = taken.has(b.dataset.color);
  }
  for (const b of app.querySelectorAll('[data-action="look-face"]')) b.classList.toggle('on', b.dataset.face === current.face);
  const input = $('#face-input');
  if (input && document.activeElement !== input) input.value = current.face; // don't fight the cursor while typing
  const preview = $('#look-preview');
  if (preview) preview.innerHTML = avatar({ ...current, name: '' }, 'big-look');
}

// ---- join screen -------------------------------------------------------------------

function joinHtml() {
  const code = new URLSearchParams(location.search).get('code') ?? '';
  return `
    <h1 class="outline-text title pop">Knock Off<br>Party Pack</h1>
    <form class="card panel rise d1" id="join-form" autocomplete="off">
      <div class="look-head">
        <div id="look-preview"></div>
        <div class="field">
          <label for="name">Your name</label>
          <input class="input" id="name" maxlength="12" spellcheck="false" autocapitalize="characters" placeholder="NAME"
                 value="${esc(local.get('lastName') ?? '')}">
        </div>
      </div>
      ${lookPicker()}
      <div class="field">
        <label for="code">Room code</label>
        <div class="join-row">
          <input class="input code" id="code" maxlength="4" autocapitalize="characters" spellcheck="false"
                 placeholder="ABCD" value="${esc(code.toUpperCase().slice(0, 4))}">
          <button class="btn go" type="submit">Join</button>
        </div>
      </div>
      <p class="sub-msg small">The room code is on the host screen.</p>
      <p class="error">${esc(joinError)}</p>
    </form>`;
}

function lockJoin() {
  const buttons = app.querySelectorAll('#join-form button[type="submit"]');
  buttons.forEach((b) => (b.disabled = true));
  setTimeout(() => buttons.forEach((b) => (b.disabled = false)), 1500);
}

// ---- lobby ----------------------------------------------------------------------------
// The host screen shows the room code and everyone who's in; the VIP's phone picks the game.

const lobbyHtml = () => `
  <div class="card panel center pop">
    <div id="look-preview"></div>
    <p class="big-msg">You're in!</p>
    <p class="sub-msg" id="lobby-room"></p>
    ${editingLook ? '' : '<button class="btn small" data-action="edit-look">✏️ Change name, color or face</button>'}
  </div>
  ${editingLook ? `
    <form class="card panel rise" id="lobby-edit" autocomplete="off">
      <div class="field">
        <label for="lobby-name">Your name</label>
        <input class="input" id="lobby-name" maxlength="12" spellcheck="false" autocapitalize="characters" value="${esc(state.players.find((p) => p.id === state.you.id)?.name ?? '')}">
      </div>
      <p class="error" id="name-error"></p>
      ${lookPicker()}
      <button class="btn go wide" type="submit">Done</button>
    </form>` : ''}
  <div id="lobby-vip" class="actions rise d1"></div>`;

function patchLobby(s) {
  const me = s.players.find((p) => p.id === s.you.id);
  if (me) patchLook(me, new Set(s.players.filter((p) => p.id !== me.id).map((p) => p.color)));
  $('#lobby-room').textContent = `Room ${s.code} · ${s.players.length} player${s.players.length === 1 ? '' : 's'}${s.screenConnected ? '' : ' · host screen offline'}`;
  const vip = s.players.find((p) => p.isVip)?.name ?? 'the VIP';
  const game = s.games.find((g) => g.id === s.gameId);
  $('#lobby-vip').innerHTML = s.isVip ? `
    <div class="label on-bg">👑 You're the VIP: pick a game</div>
    <div class="game-picker">${s.games.map((g) => `
      <button class="game-card card ${g.id === s.gameId ? 'on' : ''}" data-action="select-game" data-game="${g.id}">
        <strong>${esc(g.title)}</strong><span>${esc(g.tagline)}</span>
      </button>`).join('')}
    </div>
    <button class="btn go wide" data-action="start" ${s.canStart ? '' : 'disabled'}>Start ${esc(game?.title ?? 'game')}</button>
    ${s.canStart ? '' : `<p class="sub-msg small center-text">Needs ${game?.minPlayers ?? 2}+ players</p>`}` : `
    <div class="card panel center"><p class="sub-msg">Waiting for ${esc(vip)} 👑 to start…</p></div>`;
}

// ---- results -----------------------------------------------------------------------------
// The leaderboard is on the host screen; your phone shows your place.

function resultsHtml(s) {
  const me = s.results.standings.find((st) => st.id === s.you.id);
  const vip = s.players.find((p) => p.isVip)?.name ?? 'the VIP';
  return `
    <div class="center-stack">
      <h1 class="outline-text mega pop">${me ? (me.rank === 1 ? 'You win!' : `${ordinal(me.rank)} place`) : 'Game over'}</h1>
      ${me ? `<p class="big-msg rise d1">${fmt(me.score)} pts</p>` : ''}
    </div>
    <div class="actions rise d3">
      ${s.isVip
        ? '<button class="btn go wide" data-action="lobby">Back to lobby</button>'
        : `<div class="card panel center"><p class="sub-msg">Waiting for ${esc(vip)} 👑…</p></div>`}
    </div>`;
}

// ---- input -------------------------------------------------------------------------------

/** Picks a color or face: before joining it's just saved; in the lobby the room is told too. */
function pickLook(change) {
  const next = { ...look, ...change };
  if (!state) {
    saveLook(next);
    return patchLook(look, new Set());
  }
  socket.emit('player:look', next, (res) => res.ok && saveLook(res.look));
}

/** Done in the lobby's edit panel: color and face are already saved; a new name is checked by the room. */
function saveLobbyEdit(form) {
  const name = $('#lobby-name').value;
  const close = () => {
    editingLook = false;
    render();
  };
  const current = state.players.find((p) => p.id === state.you.id)?.name;
  if (name.replace(/\s+/g, ' ').trim().toUpperCase() === current) return close();
  form.querySelector('[type="submit"]').disabled = true;
  socket.emit('player:name', name, (res) => {
    form.querySelector('[type="submit"]').disabled = false;
    if (!res.ok) {
      $('#name-error').textContent = res.error;
      return;
    }
    // Remembered for reconnecting and for next time.
    session.set('seat', { ...session.get('seat'), name: res.name });
    local.set('lastName', res.name);
    close();
  });
}

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const action = el.dataset.action;
  switch (action) {
    case 'look-color':
      return pickLook({ color: el.dataset.color });
    case 'look-face':
      return pickLook({ face: el.dataset.face });
    case 'edit-look':
      editingLook = true;
      return render();
    case 'select-game':
      return state?.isVip && socket.emit('room:selectGame', el.dataset.game);
    case 'start':
      return socket.emit('room:start');
    case 'lobby':
      return socket.emit('room:lobby');
  }
  if (state?.phase === 'playing') GAME_UI[state.gameId]?.onClick?.(action, el, send, app);
});

// Names are always capitals, so they turn into capitals as you type (keeping the cursor in place).
// Typing a face: every keystroke updates your preview (and the room, in the lobby).
app.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'name' || t.id === 'lobby-name') {
    const { selectionStart, selectionEnd } = t;
    t.value = t.value.toUpperCase();
    t.setSelectionRange(selectionStart, selectionEnd);
  }
  if (t.id === 'lobby-name') $('#name-error').textContent = '';
  if (e.target.id !== 'face-input') return;
  const face = cleanFace(e.target.value);
  if (face) pickLook({ face });
});
app.addEventListener('focusout', (e) => {
  if (e.target.id === 'face-input') e.target.value = look.face; // an empty or cleaned-up face snaps back
});

app.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'join-form') {
    lockJoin();
    return join({ code: $('#code').value.trim().toUpperCase(), name: $('#name').value });
  }
  if (e.target.id === 'lobby-edit') return saveLobbyEdit(e.target);
  if (state?.phase === 'playing') GAME_UI[state.gameId]?.onSubmit?.(e.target, send);
});
