import { randomInt } from '../random.js';
import { rankScores } from '../util.js';
import { buildRound } from './ego-questions.js';

// Each question: everyone answers, then everyone checks off the other players
// they think fit the "spotlight" (said Yes / got it right / picked a thing).
// Points come from reading other players right.
const ROUNDS = [
  { type: 'yesno', title: 'Round 1', subtitle: 'Yes or No', questions: 3, guessPoints: 100,
    intro: 'Answer honestly. Then guess who said YES!' },
  { type: 'trivia', title: 'Round 2', subtitle: 'Trivia', questions: 3, guessPoints: 150, rightPoints: 100,
    intro: 'Answer the trivia. Then guess who got it right!' },
  { type: 'pick', title: 'Round 3', subtitle: 'Pick One', questions: 3, guessPoints: 200,
    intro: 'Pick one of three. Then guess who picked what!' },
];
const TIMING = { roundIntro: 4000, answer: 15000, reveal: 7000, scores: 6000 };
// Guessing gets more time the more players there are to check off.
const guessTime = (targets) => 10000 + targets * 2500;

class EgoCheck {
  constructor(room) {
    this.room = room;
    this.ids = [...room.players.keys()];
    this.scores = new Map(this.ids.map((id) => [id, 0]));
    this.answers = new Map(); // playerId -> option index, for the current question
    this.guesses = new Map(); // playerId -> Set of players they checked
    this.roundIndex = -1;
    this.questionIndex = -1;
    this.questions = [];
    this.spotlight = null; // option index the guesses are about
    this.guessMs = 0;
    this.results = null;
    this.deadline = 0;
    this.timer = null;
  }

  get round() { return ROUNDS[this.roundIndex] ?? null; }
  get question() { return this.questions[this.questionIndex] ?? null; }

  start() { this.nextRound(); }

  destroy() { clearTimeout(this.timer); }

  connectedIds() { return this.ids.filter((id) => this.room.players.get(id)?.connected); }

  /** The players `id` guesses about: everyone else who answered, in seat order. */
  targetsOf(id) { return this.ids.filter((t) => t !== id && this.answers.has(t)); }

  /** Whether player `id` fits the spotlight (said Yes, got it right, picked it). */
  fits(id) { return this.answers.get(id) === this.spotlight; }

  guessers() { return this.connectedIds().filter((id) => this.targetsOf(id).length); }

  playerLeft() {
    if (this.phase === 'answer' && this.connectedIds().every((id) => this.answers.has(id))) this.endAnswers();
    if (this.phase === 'guess' && this.guessers().every((id) => this.guesses.has(id))) this.endGuesses();
  }

  setPhase(phase, ms, then) {
    clearTimeout(this.timer);
    this.phase = phase;
    this.deadline = Date.now() + (ms ?? 0);
    if (ms) this.timer = setTimeout(then, ms);
    this.room.sync();
  }

  nextRound() {
    this.roundIndex++;
    this.questions = buildRound(this.round.type, this.round.questions);
    this.questionIndex = -1;
    this.setPhase('roundIntro', TIMING.roundIntro, () => this.nextQuestion());
  }

  nextQuestion() {
    this.questionIndex++;
    if (this.questionIndex >= this.questions.length) {
      if (this.roundIndex >= ROUNDS.length - 1) return this.room.finish(this.scores);
      return this.setPhase('scores', TIMING.scores, () => this.nextRound());
    }
    this.answers.clear();
    this.guesses.clear();
    this.spotlight = null;
    this.results = null;
    this.setPhase('answer', TIMING.answer, () => this.endAnswers());
  }

  input(playerId, data) {
    if (!this.scores.has(playerId)) return;
    if (data?.type === 'answer' && this.phase === 'answer' && !this.answers.has(playerId)) {
      const i = data.answer;
      if (!Number.isInteger(i) || i < 0 || i >= this.question.options.length) return;
      this.answers.set(playerId, i);
      if (this.connectedIds().every((id) => this.answers.has(id))) this.endAnswers();
      else this.room.sync();
    } else if (data?.type === 'guess' && this.phase === 'guess' && !this.guesses.has(playerId)) {
      if (!Array.isArray(data.checked)) return;
      const targets = new Set(this.targetsOf(playerId));
      this.guesses.set(playerId, new Set(data.checked.filter((id) => targets.has(id))));
      if (this.guessers().every((id) => this.guesses.has(id))) this.endGuesses();
      else this.room.sync();
    }
  }

  endAnswers() {
    if (this.phase !== 'answer') return;
    const q = this.question;
    if (this.round.type === 'yesno') this.spotlight = 0;
    else if (this.round.type === 'trivia') this.spotlight = q.correctIndex;
    else {
      // Pick One: ask about one of the options somebody picked.
      const picked = [...new Set(this.answers.values())];
      this.spotlight = picked.length ? picked[randomInt(picked.length)] : 0;
    }
    if (!this.guessers().length) return this.endGuesses(true);
    this.guessMs = guessTime(Math.max(...this.guessers().map((id) => this.targetsOf(id).length)));
    this.setPhase('guess', this.guessMs, () => this.endGuesses());
  }

  endGuesses(skipped = false) {
    if (this.phase !== 'guess' && !skipped) return;
    const { guessPoints, rightPoints = 0 } = this.round;
    const readBy = new Map(); // target -> [guessers who read them right, guessers who tried]
    const gained = new Map(this.ids.map((id) => [id, 0]));
    for (const [guesser, checked] of this.guesses) {
      for (const t of this.targetsOf(guesser)) {
        const right = checked.has(t) === this.fits(t);
        if (right) gained.set(guesser, gained.get(guesser) + guessPoints);
        const [r, n] = readBy.get(t) ?? [0, 0];
        readBy.set(t, [r + (right ? 1 : 0), n + 1]);
      }
    }
    if (rightPoints) for (const id of this.answers.keys()) if (this.fits(id)) gained.set(id, gained.get(id) + rightPoints);
    for (const [id, pts] of gained) this.scores.set(id, this.scores.get(id) + pts);
    this.results = this.ids.map((id) => {
      const [readRight, readTries] = readBy.get(id) ?? [0, 0];
      return {
        playerId: id,
        answer: this.answers.get(id) ?? null,
        fits: this.answers.has(id) && this.fits(id),
        points: gained.get(id),
        readRight,
        readTries,
      };
    });
    this.setPhase('reveal', TIMING.reveal, () => this.nextQuestion());
  }

  /** What the host screen shows: the same as a player's view, but nobody's own answers. */
  screenView() { return this.view(null); }

  /** What one player sees. Other players' answers only appear in the reveal. */
  view(playerId) {
    const r = this.round;
    const q = this.question;
    const asking = ['answer', 'guess', 'reveal'].includes(this.phase);
    const guessing = this.phase === 'guess' || this.phase === 'reveal';
    const timeMs = this.phase === 'answer' ? TIMING.answer : this.phase === 'guess' ? this.guessMs : 0;
    const checked = this.guesses.get(playerId);
    return {
      phase: this.phase,
      round: r && { number: this.roundIndex + 1, total: ROUNDS.length, title: r.title, subtitle: r.subtitle, type: r.type, intro: r.intro },
      question: asking ? { number: this.questionIndex + 1, total: this.questions.length, prompt: q.prompt, options: q.options } : null,
      remainingMs: timeMs ? Math.max(0, this.deadline - Date.now()) : 0,
      timeMs,
      answered: [...this.answers.keys()],
      guessed: [...this.guesses.keys()],
      answer: this.answers.get(playerId) ?? null,
      spotlight: guessing ? this.spotlight : null,
      targets: guessing ? this.targetsOf(playerId) : [],
      checked: checked ? [...checked] : null,
      reveal: this.phase === 'reveal' ? { results: this.results } : null,
      standings: rankScores(this.scores),
      myScore: this.scores.get(playerId) ?? 0,
    };
  }
}

export default {
  id: 'ego',
  title: 'Ego Check',
  tagline: 'How well do you know your friends? Guess who said what.',
  minPlayers: 2,
  create: (room) => new EgoCheck(room),
};
