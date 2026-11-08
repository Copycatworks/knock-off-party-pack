import { groupAnswers } from './match-answers.js';
import { shuffledPrompts } from './match-prompts.js';

const CRACKS_TO_HATCH = 10;
const TIMING = { intro: 5000, prompt: 25000, reveal: 8000, hatch: 9000 };
const MAX_ANSWER = 40;
// Scores only order the final standings; hatching is what wins.
const CRACK_POINTS = 250;
const HATCH_BONUS = 2500;

/**
 * Match to Hatch: everyone answers a prompt, and every player whose answer
 * matches someone else's gets a crack in their egg. Ten cracks hatches it.
 * The game ends after the round where the first eggs hatch; they win.
 */
class MatchToHatch {
  constructor(room) {
    this.room = room;
    this.ids = [...room.players.keys()];
    this.cracks = new Map(this.ids.map((id) => [id, 0]));
    this.gained = new Map(); // playerId -> cracks gained this round
    this.answers = new Map(); // playerId -> text for the current prompt
    this.prompts = shuffledPrompts();
    this.roundIndex = -1;
    this.groups = null;
    this.deadline = 0;
    this.timer = null;
  }

  get prompt() { return this.prompts[this.roundIndex % this.prompts.length]; }
  get hatched() { return this.ids.filter((id) => this.cracks.get(id) >= CRACKS_TO_HATCH); }

  start() { this.setPhase('intro', TIMING.intro, () => this.nextRound()); }

  destroy() { clearTimeout(this.timer); }

  connectedIds() { return this.ids.filter((id) => this.room.players.get(id)?.connected); }

  allAnswered() {
    const active = this.connectedIds();
    return active.length > 0 && active.every((id) => this.answers.has(id));
  }

  playerLeft() {
    if (this.phase === 'prompt' && this.allAnswered()) this.endPrompt();
  }

  setPhase(phase, ms, then) {
    clearTimeout(this.timer);
    this.phase = phase;
    if (ms) this.timer = setTimeout(then, ms);
    this.room.sync();
  }

  nextRound() {
    this.roundIndex++;
    this.answers.clear();
    this.gained.clear();
    this.groups = null;
    this.deadline = Date.now() + TIMING.prompt;
    this.setPhase('prompt', TIMING.prompt, () => this.endPrompt());
  }

  input(playerId, data) {
    if (data?.type !== 'answer' || this.phase !== 'prompt') return;
    if (!this.cracks.has(playerId) || this.answers.has(playerId)) return;
    if (typeof data.answer !== 'string') return;
    const answer = data.answer.trim().slice(0, MAX_ANSWER);
    if (!answer) return;
    this.answers.set(playerId, answer);
    if (this.allAnswered()) this.endPrompt();
    else this.room.sync();
  }

  endPrompt() {
    if (this.phase !== 'prompt') return;
    this.groups = groupAnswers(this.answers);
    for (const group of this.groups) {
      if (!group.matched) continue;
      for (const id of group.ids) {
        const before = this.cracks.get(id);
        this.cracks.set(id, Math.min(CRACKS_TO_HATCH, before + 1));
        this.gained.set(id, this.cracks.get(id) - before);
      }
    }
    this.setPhase('reveal', TIMING.reveal, () => this.afterReveal());
  }

  afterReveal() {
    if (this.hatched.length) return this.setPhase('hatch', TIMING.hatch, () => this.finish());
    this.nextRound();
  }

  finish() {
    const hatched = new Set(this.hatched);
    const scores = new Map(this.ids.map((id) => [id, this.cracks.get(id) * CRACK_POINTS + (hatched.has(id) ? HATCH_BONUS : 0)]));
    this.room.finish(scores);
  }

  /** What the host screen shows: the same as a player's view, but nobody's own answers. */
  screenView() { return this.view(null); }

  /** What one player sees. Other players' answers only appear in the reveal. */
  view(playerId) {
    const showPrompt = this.phase === 'prompt' || this.phase === 'reveal';
    return {
      phase: this.phase,
      round: this.roundIndex + 1,
      cracksToHatch: CRACKS_TO_HATCH,
      prompt: showPrompt ? this.prompt : null,
      remainingMs: this.phase === 'prompt' ? Math.max(0, this.deadline - Date.now()) : 0,
      timeMs: TIMING.prompt,
      answered: [...this.answers.keys()],
      answer: this.answers.get(playerId) ?? null,
      groups: this.phase === 'reveal' ? this.groups : null,
      // `gained` lets the reveal shake and crack the eggs that just matched.
      eggs: this.ids.map((id) => ({ id, cracks: this.cracks.get(id), gained: this.gained.get(id) ?? 0 })),
      hatched: this.phase === 'hatch' ? this.hatched : [],
    };
  }
}

export default {
  id: 'match',
  title: 'Match to Hatch',
  tagline: 'Think alike to crack your egg. First to hatch wins!',
  minPlayers: 2,
  create: (room) => new MatchToHatch(room),
};
