// The host screen: the window on the PC that gets streamed (or shown on a TV).
// It makes the room, shows the room code and lobby, every game's shared screens
// (from the matching module in screens/) and the results. It never takes input:
// players play on their phones, and the VIP's phone moves things along.
import { $, esc, avatar, leaderboard, session, setTheme, setCountdown, watchConnection } from './common.js';
import { SCREEN_UI } from './screens/index.js';
import { screenSocket } from './server/index.js';

const socket = screenSocket(); // the room runs right here, in this window (server/index.js)
const stage = $('#stage');
let state = null;
let screenKey = '';

// Everything is laid out on a 1280×720 stage, scaled to fill the window, so the
// screen looks the same in a small window, at 1080p or on a TV.
const STAGE_W = 1280, STAGE_H = 720;
function fit() { stage.style.zoom = Math.min(innerWidth / STAGE_W, innerHeight / STAGE_H); }
addEventListener('resize', fit);
fit();

watchConnection(socket);

// A refresh tries to keep the room code (it's remembered per tab), so phones can
// find the room again; a new window makes a new room.
socket.on('connect', () => {
  socket.emit('host:hello', session.get('screen') ?? {}, (res) => session.set('screen', { code: res.code }));
});

// The room couldn't open (usually no internet, or PeerJS's server is down).
socket.on('server:error', (message) => {
  state = null;
  screenKey = '';
  setTheme('bad');
  stage.innerHTML = `
    <div class="hs-center">
      <h1 class="outline-text hs-huge">Couldn't open a room</h1>
      <p class="hs-note">${esc(message)} Refresh to try again.</p>
    </div>`;
});

socket.on('state', (s) => {
  state = s;
  render();
});

// ---- rendering -------------------------------------------------------------------

function show(theme, key, html) {
  setTheme(theme);
  if (key === screenKey) return;
  screenKey = key;
  stage.innerHTML = html();
}

function render() {
  const s = state;
  if (!s) return;
  const ui = s.phase === 'playing' ? SCREEN_UI[s.gameId] : null;
  if (s.phase === 'playing' && !(ui && s.game)) return;
  const [remaining, total] = ui?.timer?.(s) ?? [0, 1];
  setCountdown(remaining, total);

  if (ui) show(ui.theme(s), `game:${ui.key(s)}`, () => ui.render(s));
  else if (s.phase === 'results') show('scores', 'results', () => resultsHtml(s));
  else show('lobby', 'lobby', lobbyHtml);

  if (s.phase === 'lobby') patchLobby(s);
  ui?.patch?.(s);
}

const joinAddress = (s) => (s.joinUrl ?? location.origin).replace(/^https?:\/\//, '');
const vipName = (s) => s.players.find((p) => p.isVip)?.name;

// ---- lobby ----------------------------------------------------------------------------

const lobbyHtml = () => `
  <div class="hs-lobby">
    <div class="hs-col">
      <h1 class="outline-text hs-title pop">Knock Off<br>Party Pack</h1>
      <div class="card hs-join rise d1">
        <div class="label">On your phone, go to</div>
        <div class="hs-url" id="hs-url"></div>
        <div class="label">and enter the room code</div>
        <div class="code" id="hs-code"></div>
      </div>
      <div class="card hs-game rise d2" id="hs-game"></div>
    </div>
    <div class="hs-players rise d2" id="hs-players"></div>
  </div>`;

/** Shrinks an element's text until it fits its width on one line (never bigger than its CSS size). */
function fitText(el) {
  el.style.fontSize = '';
  const full = parseFloat(getComputedStyle(el).fontSize);
  if (el.scrollWidth > el.clientWidth) el.style.fontSize = `${Math.floor(full * (el.clientWidth / el.scrollWidth) * 0.97)}px`;
}

function patchLobby(s) {
  const url = $('#hs-url');
  url.textContent = joinAddress(s);
  fitText(url);
  document.fonts?.ready.then(() => url.isConnected && fitText(url)); // the display font may arrive after the first fit
  $('#hs-code').innerHTML = [...s.code].map((c) => `<span>${c}</span>`).join('');
  const game = s.games.find((g) => g.id === s.gameId);
  const vip = vipName(s);
  const need = game.minPlayers - s.players.filter((p) => p.connected).length;
  $('#hs-game').innerHTML = `
    <div class="label">Up next</div>
    <strong>${esc(game.title)}</strong>
    <span>${esc(game.tagline)}</span>
    <p class="hs-status">${!vip ? 'The first player to join is the VIP 👑'
      : need > 0 ? `Waiting for ${need} more player${need > 1 ? 's' : ''}…`
      : `${esc(vip)} 👑 picks the game and starts it`}</p>`;
  $('#hs-players').innerHTML = Array.from({ length: s.maxPlayers }, (_, i) => {
    const p = s.players[i];
    if (!p) return `<div class="hs-slot empty"><span>Player ${i + 1}</span></div>`;
    return `
      <div class="hs-slot card ${p.connected ? '' : 'offline'} pop">
        ${avatar(p, 'hs-avatar')}
        <span class="name">${esc(p.name)}</span>
        ${p.isVip ? '<span class="hs-vip">👑 VIP</span>' : ''}
      </div>`;
  }).join('');
}

// ---- results -----------------------------------------------------------------------------

function resultsHtml(s) {
  const r = s.results;
  const players = new Map(s.players.map((p) => [p.id, p]));
  const winners = r.standings.filter((st) => st.rank === 1).map((st) => players.get(st.id)).filter(Boolean);
  const title = s.games.find((g) => g.id === r.gameId)?.title ?? '';
  return `
    <div class="hs-results">
      <div class="hs-col">
        <div class="pill">${esc(title)}</div>
        <div class="hs-winners pop">${winners.map((p) => avatar(p, 'hs-winner')).join('')}</div>
        <h1 class="outline-text hs-huge pop d2">${winners.length ? `${winners.map((p) => esc(p.name)).join(' & ')} ${winners.length > 1 ? 'win' : 'wins'}!` : 'Game over'}</h1>
        <p class="hs-note rise d3">${vipName(s) ? `${esc(vipName(s))} 👑 can head back to the lobby` : ''}</p>
      </div>
      <div class="hs-col">
        ${leaderboard(r.standings, s.players)}
      </div>
    </div>`;
}

