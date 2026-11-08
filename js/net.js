// Networking over PeerJS (WebRTC), so the game runs with no server of its own:
// the host screen's browser runs the room (js/server/), and each phone connects
// straight to it. PeerJS's free public server only introduces the two; after
// that, everything goes directly between the phone and the host screen.
//
// Both sides talk through a small object shaped like a socket.io socket
// (on / emit with an optional reply callback), so the rest of the code reads
// the same as it did when there was a Node server.
//
// Messages are JSON strings (the same rules socket.io used), sent with PeerJS's
// default binary mode, which splits big ones (like a round of drawings) into chunks.
//   { t: 'e', ev, data, id? }  an event; `id` asks for a reply
//   { t: 'a', id, data }       the reply
//   { t: 'p' }                 a heartbeat

/* global Peer */

const PREFIX = 'knockoffpartypack-v1-';
export const peerIdFor = (code) => PREFIX + code;

export const HEARTBEAT_MS = 2000;
export const TIMEOUT_MS = 12000; // nothing heard for this long: the other side is gone

/** A tiny event emitter, used for the socket-like objects. */
export class Emitter {
  constructor() { this.handlers = new Map(); }
  on(ev, fn) {
    if (!this.handlers.has(ev)) this.handlers.set(ev, []);
    this.handlers.get(ev).push(fn);
    return this;
  }
  fire(ev, ...args) {
    for (const fn of this.handlers.get(ev) ?? []) fn(...args);
  }
}

export const pack = (msg) => JSON.stringify(msg);
export function unpack(raw) {
  try { return typeof raw === 'string' ? JSON.parse(raw) : null; } catch { return null; }
}

/** A plain-language reason for a PeerJS error. */
export function friendlyError(err) {
  const t = err?.type;
  if (t === 'peer-unavailable') return 'Room not found. Check the code.';
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed')
    return "Couldn't reach the connection server. Check your internet connection.";
  if (t === 'browser-incompatible') return "This browser can't connect to games (no WebRTC).";
  return err?.message || 'Connection error.';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The phone's link to a host screen. It acts like a socket.io socket: 'connect'
 * fires when it's ready (right away at first, since a phone only picks a room when
 * it joins), 'disconnect' when the host screen stops answering, and 'connect'
 * again once it's back. Emitting 'room:join' connects to that room's host screen
 * first.
 */
export function phoneSocket() {
  const socket = new Emitter();
  let peer = null;
  let conn = null;
  let code = null; // the room we're connected (or reconnecting) to
  let nextId = 1;
  const replies = new Map(); // id -> callback
  let lastHeard = 0;
  let beat = null;
  let connecting = null; // the connection attempt in progress, if any

  // Our own peer, made once. PeerJS assigns it a random id.
  function ready() {
    if (peer && !peer.destroyed && peer.open) return Promise.resolve(peer);
    if (peer && !peer.destroyed && !peer.disconnected) return new Promise((resolve, reject) => {
      peer.once('open', () => resolve(peer));
      peer.once('error', (e) => reject(friendlyError(e)));
    });
    peer?.destroy();
    peer = new Peer();
    peer.on('disconnected', () => { try { peer.reconnect(); } catch { /* it'll be remade next time */ } });
    return new Promise((resolve, reject) => {
      peer.once('open', () => resolve(peer));
      peer.once('error', (e) => reject(friendlyError(e)));
    });
  }

  /** Opens a connection to a room's host screen. Rejects with a message if it can't. */
  async function open(roomCode) {
    const me = await ready();
    return new Promise((resolve, reject) => {
      const c = me.connect(peerIdFor(roomCode), { reliable: true });
      let settled = false;
      const fail = (msg) => {
        if (settled) return;
        settled = true;
        me.off('error', onPeerError);
        try { c.close(); } catch { /* ignore */ }
        reject(msg);
      };
      // A room that doesn't exist shows up as an error on the peer, not the connection.
      const onPeerError = (e) => { if (e.type === 'peer-unavailable' || e.type === 'network') fail(friendlyError(e)); };
      me.on('error', onPeerError);
      setTimeout(() => fail("Couldn't reach that room. Check the code, or try again."), 15000);
      c.on('open', () => {
        if (settled) return;
        settled = true;
        me.off('error', onPeerError);
        resolve(c);
      });
      c.on('error', () => fail("Couldn't reach that room."));
    });
  }

  function attach(c, roomCode) {
    conn = c;
    code = roomCode;
    lastHeard = Date.now();
    c.on('data', (raw) => {
      lastHeard = Date.now();
      const msg = unpack(raw);
      if (!msg || msg.t === 'p') return;
      if (msg.t === 'a') {
        replies.get(msg.id)?.(msg.data);
        replies.delete(msg.id);
      } else if (msg.t === 'e') socket.fire(msg.ev, msg.data);
    });
    c.on('close', () => dropped(c));
    clearInterval(beat);
    beat = setInterval(() => {
      if (Date.now() - lastHeard > TIMEOUT_MS) dropped(c);
      else if (c.open) c.send(pack({ t: 'p' }));
    }, HEARTBEAT_MS);
  }

  function dropped(c) {
    if (conn !== c) return;
    conn = null;
    clearInterval(beat);
    try { c.close(); } catch { /* ignore */ }
    for (const reply of replies.values()) reply({ ok: false, error: 'Lost the connection.' });
    replies.clear();
    socket.fire('disconnect');
    reconnect();
  }

  // Keep trying the same room for a while (a phone that slept, a host screen that
  // refreshed). Either way, 'connect' fires so the app rejoins: if the room is
  // gone, that join fails and the app says so.
  async function reconnect() {
    const roomCode = code;
    for (let i = 0; i < 8 && code === roomCode && !conn; i++) {
      try {
        attach(await open(roomCode), roomCode);
        break;
      } catch { await sleep(2000); }
    }
    if (code === roomCode) socket.fire('connect');
  }

  function send(ev, data, reply) {
    const msg = { t: 'e', ev, data };
    if (reply) {
      msg.id = nextId++;
      replies.set(msg.id, reply);
    }
    if (conn?.open) conn.send(pack(msg));
    else if (reply) {
      replies.delete(msg.id);
      reply({ ok: false, error: 'Not connected to a room.' });
    }
  }

  socket.emit = (ev, data, reply) => {
    if (ev !== 'room:join') return send(ev, data, reply);
    const roomCode = String(data?.code ?? '').trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(roomCode)) return reply?.({ ok: false, error: 'Room codes are 4 letters.' });
    if (conn?.open && code === roomCode) return send(ev, data, reply);
    // switching rooms (or not in one yet): connect first
    if (conn) { const old = conn; conn = null; clearInterval(beat); try { old.close(); } catch { /* ignore */ } }
    code = roomCode;
    connecting = open(roomCode);
    const attempt = connecting;
    attempt.then(
      (c) => {
        if (connecting !== attempt) return c.close();
        attach(c, roomCode);
        send(ev, data, reply);
      },
      (error) => {
        if (connecting !== attempt) return;
        code = null;
        reply?.({ ok: false, error });
      },
    );
  };

  /** Forget the room (the app calls this when a join fails, so it stops reconnecting). */
  socket.leave = () => {
    code = null;
    connecting = null;
    if (conn) { const old = conn; conn = null; clearInterval(beat); try { old.close(); } catch { /* ignore */ } }
  };

  // Close promptly when the tab goes away, so the host screen notices right away.
  addEventListener('pagehide', () => { try { peer?.destroy(); } catch { /* ignore */ } });

  setTimeout(() => socket.fire('connect'));
  return socket;
}
