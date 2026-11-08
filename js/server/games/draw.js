import { randomInt } from '../random.js';
import { sanitizeDrawing } from '../../drawing.js';
import { rankScores } from '../util.js';
import { pickCharacters } from './draw-prompts.js';

const ROUNDS = [
  { title: 'Round 1', subtitle: 'Head to Head', headToHead: true, drawMs: 80000, votePoints: 100, winBonus: 250,
    intro: 'You and an opponent draw the same character from memory. Everyone else votes who got closer!' },
  { title: 'Round 2', subtitle: 'Everybody Draws', headToHead: false, drawMs: 90000, votePoints: 150, winBonus: 500,
    intro: 'Everyone draws the same character from memory. Vote for the most accurate one!' },
];
const TIMING = { roundIntro: 4500, scores: 6000 };
const LIKE_POINTS = 25;
// Voting gets longer the more drawings there are to look at.
const voteTime = (entries) => 10000 + entries * 3000;
const resultTime = (entries) => 5000 + entries * 1000;

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Memory Draw: draw a well-known character from memory, then vote on whose
 * drawing is closest. Round 1 is head to head (a 3-way matchup when the player
 * count is odd); round 2 everyone draws the same character. Anyone can also
 * give drawings a thumbs up for a few bonus points.
 */
class MemoryDraw {
  constructor(room) {
    this.room = room;
    this.ids = [...room.players.keys()];
    this.scores = new Map(this.ids.map((id) => [id, 0]));
    this.characters = pickCharacters(Math.ceil(this.ids.length / 2) + 1);
    this.roundIndex = -1;
    this.matchups = []; // [{ ids, prompt, order }]: order is the anonymous display order
    this.matchIndex = -1;
    this.drawings = new Map(); // playerId -> strokes, this round
    this.done = new Set(); // players who finished drawing
    this.votes = new Map(); // voter -> drawer, current matchup
    this.likes = new Map(); // player -> Set of drawers they liked, current matchup
    this.result = null;
    this.deadline = 0;
    this.phaseMs = 0;
    this.timer = null;
  }

  get round() { return ROUNDS[this.roundIndex] ?? null; }
  get matchup() { return this.matchups[this.matchIndex] ?? null; }

  start() { this.nextRound(); }

  destroy() { clearTimeout(this.timer); }

  connectedIds() { return this.ids.filter((id) => this.room.players.get(id)?.connected); }

  matchupOf(id) { return this.matchups.find((m) => m.ids.includes(id)); }

  /** Who votes on the current matchup: everyone not in it, or if that's nobody, its own artists. */
  voters() {
    const m = this.matchup;
    const others = this.connectedIds().filter((id) => !m.ids.includes(id));
    return others.length ? others : this.connectedIds().filter((id) => m.ids.includes(id));
  }

  playerLeft() {
    if (this.phase === 'draw' && this.connectedIds().every((id) => this.done.has(id))) this.endDrawing();
    if (this.phase === 'vote' && this.voters().every((id) => this.votes.has(id))) this.endVote();
  }

  setPhase(phase, ms, then) {
    clearTimeout(this.timer);
    this.phase = phase;
    this.phaseMs = ms;
    this.deadline = Date.now() + ms;
    this.timer = setTimeout(then, ms);
    this.room.sync();
  }

  nextRound() {
    this.roundIndex++;
    this.drawings.clear();
    this.done.clear();
    this.matchIndex = -1;
    if (this.round.headToHead) {
      // Pairs, with a 3-way matchup when the count is odd.
      const order = shuffle(this.ids);
      const groups = [];
      for (let i = 0; i + 1 < order.length; i += 2) groups.push(order.slice(i, i + 2));
      if (order.length % 2) groups.at(-1).push(order.at(-1));
      this.matchups = groups.map((ids, i) => ({ ids, prompt: this.characters[i], order: shuffle(ids) }));
    } else {
      this.matchups = [{ ids: [...this.ids], prompt: this.characters.at(-1), order: shuffle(this.ids) }];
    }
    this.setPhase('roundIntro', TIMING.roundIntro, () => this.startDrawing());
  }

  startDrawing() {
    this.setPhase('draw', this.round.drawMs, () => this.endDrawing());
  }

  endDrawing() {
    if (this.phase !== 'draw') return;
    this.nextMatchup();
  }

  nextMatchup() {
    this.matchIndex++;
    if (this.matchIndex >= this.matchups.length) {
      if (this.roundIndex >= ROUNDS.length - 1) return this.room.finish(this.scores);
      return this.setPhase('scores', TIMING.scores, () => this.nextRound());
    }
    this.votes.clear();
    this.likes.clear();
    this.result = null;
    this.setPhase('vote', voteTime(this.matchup.ids.length), () => this.endVote());
  }

  input(playerId, data) {
    if (!this.scores.has(playerId)) return;
    if (this.phase === 'draw' && (data?.type === 'drawing' || data?.type === 'done') && !this.done.has(playerId)) {
      this.drawings.set(playerId, sanitizeDrawing(data.strokes));
      if (data.type !== 'done') return; // saved for the deadline; nothing to show anyone yet
      this.done.add(playerId);
      if (this.connectedIds().every((id) => this.done.has(id))) this.endDrawing();
      else this.room.sync();
      return;
    }
    if (this.phase !== 'vote') return;
    const drawer = this.matchup.order[data?.entry];
    if (!drawer || drawer === playerId) return;
    if (data.type === 'vote' && !this.votes.has(playerId) && this.voters().includes(playerId)) {
      this.votes.set(playerId, drawer);
      if (this.voters().every((id) => this.votes.has(id))) this.endVote();
      else this.room.sync();
    } else if (data.type === 'like') {
      if (!this.likes.has(playerId)) this.likes.set(playerId, new Set());
      this.likes.get(playerId)[data.on ? 'add' : 'delete'](drawer);
      this.room.sync();
    }
  }

  endVote() {
    if (this.phase !== 'vote') return;
    const { votePoints, winBonus } = this.round;
    const m = this.matchup;
    const votesFor = (id) => [...this.votes].filter(([, d]) => d === id).map(([voter]) => voter);
    const likesFor = (id) => [...this.likes.values()].filter((set) => set.has(id)).length;
    const best = Math.max(0, ...m.ids.map((id) => votesFor(id).length));
    this.result = m.order.map((id) => {
      const voters = votesFor(id);
      const likes = likesFor(id);
      const winner = best > 0 && voters.length === best;
      const points = voters.length * votePoints + (winner ? winBonus : 0) + likes * LIKE_POINTS;
      this.scores.set(id, this.scores.get(id) + points);
      return { playerId: id, drawing: this.drawings.get(id) ?? [], voters, likes, winner, points };
    });
    this.setPhase('result', resultTime(m.ids.length), () => this.nextMatchup());
  }

  /** What the host screen shows: the same as a player's view, but the drawings to vote on. */
  screenView() { return this.view(null); }

  /** What one player sees (playerId null: the host screen). Drawings stay anonymous until the result. */
  view(playerId) {
    const r = this.round;
    const m = this.matchup;
    const mine = this.matchupOf(playerId);
    const timed = this.phase === 'draw' || this.phase === 'vote';
    return {
      phase: this.phase,
      round: r && { number: this.roundIndex + 1, total: ROUNDS.length, title: r.title, subtitle: r.subtitle, headToHead: r.headToHead, intro: r.intro },
      remainingMs: timed ? Math.max(0, this.deadline - Date.now()) : 0,
      timeMs: timed ? this.phaseMs : 0,
      // drawing
      prompt: this.phase === 'draw' ? mine?.prompt ?? null : null,
      opponents: this.phase === 'draw' && r.headToHead ? mine?.ids.filter((id) => id !== playerId) ?? [] : [],
      myDrawing: this.phase === 'draw' ? this.drawings.get(playerId) ?? [] : null,
      done: [...this.done],
      // voting and results
      matchup: m && (this.phase === 'vote' || this.phase === 'result') ? {
        number: this.matchIndex + 1,
        total: this.matchups.length,
        prompt: m.prompt,
        entries: this.phase === 'vote' ? m.order.map((id) => ({ drawing: playerId === null ? this.drawings.get(id) ?? [] : null, mine: id === playerId })) : null,
        result: this.phase === 'result' ? (playerId === null ? this.result : this.result.map(({ drawing, ...r }) => r)) : null,
      } : null,
      canVote: this.phase === 'vote' && this.voters().includes(playerId),
      inMatchup: !!m?.ids.includes(playerId),
      myVote: m && this.votes.has(playerId) ? m.order.indexOf(this.votes.get(playerId)) : null,
      myLikes: m ? [...(this.likes.get(playerId) ?? [])].map((id) => m.order.indexOf(id)) : [],
      voted: [...this.votes.keys()],
      voters: this.phase === 'vote' ? this.voters() : [],
      standings: rankScores(this.scores),
      myScore: this.scores.get(playerId) ?? 0,
    };
  }
}

export default {
  id: 'draw',
  title: 'Memory Draw',
  tagline: 'Draw famous characters from memory. Closest wins!',
  minPlayers: 3,
  create: (room) => new MemoryDraw(room),
};
