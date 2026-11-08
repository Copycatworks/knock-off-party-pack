import { rankScores } from '../util.js';
import { buildRound, isCorrect } from './trivia-questions.js';

const ROUNDS = [
  { type: 'choice', title: 'Round 1', subtitle: 'Multiple Choice', questions: 4, timeMs: 15000, points: 1000 },
  { type: 'free', title: 'Round 2', subtitle: 'Free Answer', questions: 4, timeMs: 20000, points: 2000 },
];
const TIMING = { roundIntro: 3500, reveal: 6000, scores: 6000 };
const MAX_ANSWER = 40;

/**
 * Trivia: multiple-choice round, then a free-answer round.
 * Game modules get the room, read its players, call room.sync() after changes
 * and room.finish(scores) when done. See games/index.js for the interface.
 */
class Trivia {
  constructor(room) {
    this.room = room;
    this.ids = [...room.players.keys()];
    this.scores = new Map(this.ids.map((id) => [id, 0]));
    this.answers = new Map(); // playerId -> { answer, at } for the current question
    this.roundIndex = -1;
    this.questionIndex = -1;
    this.questions = [];
    this.results = null;
    this.deadline = 0;
    this.timer = null;
  }

  get round() { return ROUNDS[this.roundIndex] ?? null; }
  get question() { return this.questions[this.questionIndex] ?? null; }

  start() { this.nextRound(); }

  destroy() { clearTimeout(this.timer); }

  connectedIds() { return this.ids.filter((id) => this.room.players.get(id)?.connected); }

  allAnswered() {
    const active = this.connectedIds();
    return active.length > 0 && active.every((id) => this.answers.has(id));
  }

  playerLeft() {
    if (this.phase === 'question' && this.allAnswered()) this.endQuestion();
  }

  setPhase(phase, ms, then) {
    clearTimeout(this.timer);
    this.phase = phase;
    if (ms) this.timer = setTimeout(then, ms);
    this.room.sync();
  }

  nextRound() {
    this.roundIndex++;
    this.questions = buildRound(this.round);
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
    this.results = null;
    this.deadline = Date.now() + this.round.timeMs;
    this.setPhase('question', this.round.timeMs, () => this.endQuestion());
  }

  input(playerId, data) {
    if (data?.type !== 'answer' || this.phase !== 'question') return;
    if (!this.scores.has(playerId) || this.answers.has(playerId)) return;
    const q = this.question;
    let answer = data.answer;
    if (q.type === 'choice') {
      if (!Number.isInteger(answer) || answer < 0 || answer >= q.options.length) return;
    } else {
      if (typeof answer !== 'string') return;
      answer = answer.trim().slice(0, MAX_ANSWER);
      if (!answer) return;
    }
    this.answers.set(playerId, { answer, at: Date.now() });
    if (this.allAnswered()) this.endQuestion();
    else this.room.sync();
  }

  endQuestion() {
    if (this.phase !== 'question') return;
    const q = this.question;
    const { timeMs, points } = this.round;
    this.results = this.ids.map((id) => {
      const a = this.answers.get(id);
      const correct = isCorrect(q, a?.answer);
      // Half the points for being right, the other half scaled by speed.
      const speed = correct ? Math.max(0, this.deadline - a.at) / timeMs : 0;
      const gained = correct ? Math.round((points * (0.5 + 0.5 * speed)) / 10) * 10 : 0;
      this.scores.set(id, this.scores.get(id) + gained);
      return { playerId: id, answer: a?.answer ?? null, correct, points: gained };
    });
    this.setPhase('reveal', TIMING.reveal, () => this.nextQuestion());
  }

  /** What the host screen shows: the same as a player's view, but nobody's own answers. */
  screenView() { return this.view(null); }

  /** What one player sees. Others' answers and the correct answer only appear in the reveal. */
  view(playerId) {
    const r = this.round;
    const q = this.question;
    const showQuestion = q && (this.phase === 'question' || this.phase === 'reveal');
    return {
      phase: this.phase,
      round: r && { number: this.roundIndex + 1, total: ROUNDS.length, title: r.title, subtitle: r.subtitle, type: r.type, timeMs: r.timeMs },
      question: showQuestion
        ? { number: this.questionIndex + 1, total: this.questions.length, type: q.type, prompt: q.prompt, options: q.options ?? null, inputHint: q.inputHint ?? 'text' }
        : null,
      remainingMs: this.phase === 'question' ? Math.max(0, this.deadline - Date.now()) : 0,
      answered: [...this.answers.keys()],
      answer: this.answers.get(playerId)?.answer ?? null,
      reveal: this.phase === 'reveal' ? { answer: q.answer, correctIndex: q.correctIndex ?? null, results: this.results } : null,
      standings: rankScores(this.scores),
      myScore: this.scores.get(playerId) ?? 0,
    };
  }
}

export default {
  id: 'trivia',
  title: 'Trivia Test',
  tagline: 'Quick math, fast fingers. Two rounds.',
  minPlayers: 1, // 1 for testing
  create: (room) => new Trivia(room),
};
