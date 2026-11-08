import { randomHex } from './random.js';
import { COLORS, cleanLook } from '../looks.js';
import { GAMES, GAME_LIST } from './games/index.js';
import { rankScores } from './util.js';

const MAX_PLAYERS = 8;
const MAX_NAME = 12;
const IDLE_EXPIRE_MS = 10 * 60 * 1000;

const cleanName = (raw) => String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME).toUpperCase();

/**
 * One room: the host screen, the players, which game is picked, and the room's phase:
 *   lobby -> playing (a game module runs) -> results -> lobby
 * The room is the single source of truth; phones only send inputs. Every change
 * ends with sync(), which sends the host screen the public view and each player
 * their own controller view.
 * The host screen (the window that gets streamed) creates the room. The first
 * player to join is the VIP, who picks the game and moves things along.
 */
export class Room {
  constructor(io, { code, joinUrl, onExpire }) {
    this.io = io;
    this.code = code;
    this.joinUrl = joinUrl;
    this.onExpire = onExpire;
    this.screenSocketId = null; // the host screen
    this.screenKey = randomHex(12); // lets a refreshed host screen take its room back
    this.players = new Map(); // playerId -> { id, name, color, face, socketId, connected }, in join order
    this.firstId = null; // the first player to join: the VIP
    this.phase = 'lobby';
    this.gameId = GAME_LIST[0].id;
    this.game = null;
    this.results = null;
    this.idleTimer = null;
  }

  destroy() {
    this.game?.destroy();
    clearTimeout(this.idleTimer);
  }

  // ---- connections ----------------------------------------------------------

  attachScreen(socketId) {
    if (this.screenSocketId && this.screenSocketId !== socketId) this.io.to(this.screenSocketId).emit('screen:replaced');
    this.screenSocketId = socketId;
    clearTimeout(this.idleTimer);
    this.sync();
  }

  detachScreen(socketId) {
    if (this.screenSocketId !== socketId) return;
    this.screenSocketId = null;
    this.checkIdle();
    this.sync();
  }

  join(socketId, playerId, rawName, look) {
    let p = this.players.get(playerId);
    if (!p) {
      if (this.phase !== 'lobby') return { ok: false, error: 'That game already started.' };
      if (this.players.size >= MAX_PLAYERS) return { ok: false, error: 'That room is full.' };
      const name = cleanName(rawName);
      if (!name) return { ok: false, error: 'Enter a name.' };
      if ([...this.players.values()].some((o) => o.name === name)) return { ok: false, error: 'That name is taken.' };
      p = { id: playerId, name, socketId: null, connected: false };
      this.players.set(playerId, p);
      this.firstId ??= playerId;
      this.applyLook(p, look);
    }
    p.socketId = socketId;
    p.connected = true;
    clearTimeout(this.idleTimer);
    this.sync();
    return { ok: true, code: this.code, name: p.name, look: { color: p.color, face: p.face } };
  }

  /** Sets a player's color and face. Colors are one per player: a taken color becomes the next free one. */
  applyLook(p, look) {
    const { color, face } = cleanLook(look);
    const taken = new Set([...this.players.values()].filter((o) => o !== p).map((o) => o.color));
    p.color = taken.has(color) ? Object.keys(COLORS).find((c) => !taken.has(c)) : color;
    p.face = face;
  }

  setLook(playerId, look) {
    const p = this.players.get(playerId);
    if (!p || this.phase !== 'lobby') return { ok: false };
    this.applyLook(p, look);
    this.sync();
    return { ok: true, look: { color: p.color, face: p.face } };
  }

  /** Renames a player (in the lobby). Names follow the same rules as joining: not empty, not taken. */
  setName(playerId, rawName) {
    const p = this.players.get(playerId);
    if (!p || this.phase !== 'lobby') return { ok: false, error: 'You can only change your name in the lobby.' };
    const name = cleanName(rawName);
    if (!name) return { ok: false, error: 'Enter a name.' };
    if ([...this.players.values()].some((o) => o !== p && o.name === name)) return { ok: false, error: 'That name is taken.' };
    p.name = name;
    this.sync();
    return { ok: true, name };
  }

  // Disconnected players keep their seat (so a refreshed phone gets it back)
  // until the room goes back to the lobby or a new game starts.
  leave(socketId) {
    for (const p of this.players.values()) {
      if (p.socketId !== socketId) continue;
      p.socketId = null;
      p.connected = false;
    }
    this.checkIdle();
    this.game?.playerLeft?.();
    this.sync();
  }

  /** With no host screen and no players connected, the room closes after a while. */
  checkIdle() {
    clearTimeout(this.idleTimer);
    if (!this.screenSocketId && this.connectedPlayers().length === 0) this.idleTimer = setTimeout(() => this.onExpire(), IDLE_EXPIRE_MS);
  }

  dropOfflinePlayers() {
    for (const p of this.players.values()) if (!p.connected) this.players.delete(p.id);
    if (!this.players.has(this.firstId)) this.firstId = this.players.keys().next().value ?? null;
  }

  connectedPlayers() { return [...this.players.values()].filter((p) => p.connected); }

  /** The first player to join while they're connected; otherwise the next connected player stands in. */
  vipId() {
    if (this.players.get(this.firstId)?.connected) return this.firstId;
    return this.connectedPlayers()[0]?.id ?? null;
  }

  // ---- flow (VIP-only actions are checked in index.js) ---------------------

  selectGame(gameId) {
    if (this.phase !== 'lobby' || !GAMES[gameId]) return;
    this.gameId = gameId;
    this.sync();
  }

  canStart() { return this.phase === 'lobby' && this.connectedPlayers().length >= GAMES[this.gameId].minPlayers; }

  start() {
    if (!this.canStart()) return;
    this.dropOfflinePlayers();
    this.phase = 'playing';
    this.results = null;
    this.game = GAMES[this.gameId].create(this);
    this.game.start();
  }

  input(playerId, data) {
    if (this.phase === 'playing') this.game.input(playerId, data);
  }

  /** Called by the game module when it's over, with a Map of playerId -> score. */
  finish(scores) {
    this.game.destroy();
    this.game = null;
    this.results = { gameId: this.gameId, standings: rankScores(scores) };
    this.phase = 'results';
    this.sync();
  }

  backToLobby() {
    if (this.phase !== 'results') return;
    this.phase = 'lobby';
    this.results = null;
    this.dropOfflinePlayers();
    this.sync();
  }

  // ---- views ---------------------------------------------------------------

  sync() {
    const vip = this.vipId();
    const shared = {
      code: this.code,
      joinUrl: this.joinUrl,
      phase: this.phase,
      maxPlayers: MAX_PLAYERS,
      vipId: vip,
      screenConnected: !!this.screenSocketId,
      games: GAME_LIST,
      gameId: this.gameId,
      players: [...this.players.values()].map((p) => ({
        id: p.id, name: p.name, color: p.color, face: p.face, connected: p.connected, isVip: p.id === vip,
      })),
      results: this.results,
    };
    if (this.screenSocketId) {
      this.io.to(this.screenSocketId).emit('state', {
        ...shared,
        canStart: this.canStart(),
        game: this.game ? this.game.screenView() : null,
      });
    }
    for (const p of this.players.values()) {
      if (!p.socketId) continue;
      const isVip = p.id === vip;
      this.io.to(p.socketId).emit('state', {
        ...shared,
        you: { id: p.id, name: p.name },
        isVip,
        canStart: isVip && this.canStart(),
        game: this.game ? this.game.view(p.id) : null,
      });
    }
  }
}
