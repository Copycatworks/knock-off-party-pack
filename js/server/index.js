// The game's "server", running inside the host screen's browser. It opens the
// room under a PeerJS id made from the room code, so phones can find it with just
// the code, then answers each phone like the old Node server did.
//
// The host screen itself talks to it through screenSocket(), a local stand-in for
// a socket, so host.js reads the same as it did with a real server.

/* global Peer */
import { Emitter, HEARTBEAT_MS, TIMEOUT_MS, friendlyError, pack, peerIdFor, unpack } from '../net.js';
import { randomInt } from './random.js';
import { Room } from './room.js';

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O, they look like 1/0
const SCREEN = 'screen'; // the host screen's "socket id" inside the room
const validId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 64;
const newCode = () => Array.from({ length: 4 }, () => CODE_LETTERS[randomInt(CODE_LETTERS.length)]).join('');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Where phones go to play: this site's address, without the host page's name. */
const joinUrl = () => new URL('./', location.href).href.replace(/\/$/, '');

export function screenSocket() {
  const screen = new Emitter();
  let peer = null;
  let room = null;
  const conns = new Map(); // socket id -> { conn, data: { code, playerId }, lastHeard }

  // What the room sends goes to the host screen (as a copy, the way it would
  // arrive over a network) or to a phone.
  const io = {
    to: (id) => ({
      emit(ev, data) {
        if (id === SCREEN) {
          const copy = data === undefined ? undefined : JSON.parse(JSON.stringify(data));
          queueMicrotask(() => screen.fire(ev, copy));
        } else {
          const c = conns.get(id)?.conn;
          if (c?.open) c.send(pack({ t: 'e', ev, data }));
        }
      },
    }),
  };

  // ---- opening the room ------------------------------------------------------

  /** Claims the PeerJS id for a room code. Resolves the open peer, or rejects with the PeerJS error. */
  function claim(code) {
    return new Promise((resolve, reject) => {
      const p = new Peer(peerIdFor(code));
      p.once('open', () => resolve(p));
      p.once('error', (e) => { p.destroy(); reject(e); });
    });
  }

  /**
   * Opens the room. After a refresh, it tries to keep the same code (PeerJS may
   * take a few seconds to let go of the old page's claim on it), so phones can find
   * it again. Otherwise it picks a new code.
   */
  async function openRoom(wanted) {
    const tries = wanted ? [wanted, wanted, wanted, wanted] : [];
    for (let i = 0; i < 6; i++) tries.push(newCode());
    let lastError = null;
    for (const [i, code] of tries.entries()) {
      try {
        peer = await claim(code);
        return code;
      } catch (e) {
        lastError = e;
        if (e.type !== 'unavailable-id') break; // a real problem, not just a taken code
        if (code === wanted && i < 3) await sleep(1500);
      }
    }
    throw lastError;
  }

  function listen() {
    peer.on('connection', (conn) => {
      const sock = { id: conn.connectionId, conn, data: {}, lastHeard: Date.now() };
      conn.on('open', () => conns.set(sock.id, sock));
      conn.on('data', (raw) => {
        sock.lastHeard = Date.now();
        const msg = unpack(raw);
        if (msg?.t !== 'e') return;
        const reply = (data) => msg.id && conn.open && conn.send(pack({ t: 'a', id: msg.id, data }));
        handle(sock, msg.ev, msg.data, reply);
      });
      const gone = () => {
        if (!conns.has(sock.id)) return;
        conns.delete(sock.id);
        try { conn.close(); } catch { /* ignore */ }
        room.leave(sock.id);
      };
      sock.gone = gone;
      conn.on('close', gone);
      conn.on('error', gone);
    });

    // Heartbeats: phones that stop answering (closed, asleep, out of range) are let go.
    setInterval(() => {
      const now = Date.now();
      for (const sock of conns.values()) {
        if (now - sock.lastHeard > TIMEOUT_MS) sock.gone();
        else if (sock.conn.open) sock.conn.send(pack({ t: 'p' }));
      }
    }, HEARTBEAT_MS);

    // Losing PeerJS's server only stops new phones from finding the room; phones
    // already in keep playing. Show the banner and keep trying to get it back.
    peer.on('disconnected', async () => {
      screen.fire('disconnect');
      while (peer.disconnected && !peer.destroyed) {
        try { peer.reconnect(); } catch { /* try again */ }
        await sleep(3000);
      }
    });
    peer.on('open', () => screen.fire('connect'));
    peer.on('error', (e) => {
      if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') screen.fire('disconnect');
    });
  }

  // ---- what phones can do (the same events the Node server had) ---------------

  function handle(sock, ev, data, reply) {
    const isVip = () => room.vipId() === sock.data.playerId;
    switch (ev) {
      // Phones join with a name and a look (color + ASCII face). playerId is a
      // per-tab secret, so a refreshed phone gets its seat back.
      case 'room:join': {
        const { code, playerId, name, look } = data ?? {};
        if (String(code ?? '').trim().toUpperCase() !== room.code) return reply({ ok: false, error: 'Room not found. Check the code.' });
        if (!validId(playerId)) return reply({ ok: false, error: 'Bad player id.' });
        const res = room.join(sock.id, playerId, name, look);
        if (res.ok) Object.assign(sock.data, { code: room.code, playerId });
        return reply(res);
      }
      // Change your name, color or face (in the lobby).
      case 'player:look': return reply(room.setLook(sock.data.playerId, data) ?? { ok: false });
      case 'player:name': return reply(room.setName(sock.data.playerId, data) ?? { ok: false, error: 'Not in a room.' });
      case 'room:selectGame': return isVip() && room.selectGame(data);
      case 'room:start': return isVip() && room.start();
      case 'room:lobby': return isVip() && room.backToLobby();
      case 'game:input': return sock.data.playerId && room.input(sock.data.playerId, data);
      default: return undefined;
    }
  }

  // ---- what the host screen can do ----------------------------------------------

  screen.emit = async (ev, data, reply) => {
    if (ev !== 'host:hello') return;
    if (room) { // already open (a repeat hello after a reconnect)
      room.attachScreen(SCREEN);
      return reply?.({ ok: true, code: room.code });
    }
    try {
      const code = await openRoom(data?.code);
      room = new Room(io, { code, joinUrl: joinUrl(), onExpire: () => {} });
      listen();
      room.attachScreen(SCREEN);
      reply?.({ ok: true, code });
    } catch (e) {
      screen.fire('server:error', friendlyError(e));
    }
  };

  // Close promptly when the tab goes away, so phones notice right away.
  addEventListener('pagehide', () => { try { peer?.destroy(); } catch { /* ignore */ } });

  setTimeout(() => screen.fire('connect'));
  return screen;
}
