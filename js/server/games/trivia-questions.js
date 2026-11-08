// Placeholder question source: simple arithmetic.
// Swap buildRound() for a real question bank later; the rest of the game only
// relies on the question shape: { type, prompt, answer, options?, correctIndex?, inputHint? }.

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (list) => list[randInt(0, list.length - 1)];

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mathProblem() {
  const op = pick(['+', '-', '×']);
  let a, b, answer;
  if (op === '+') {
    a = randInt(1, 20);
    b = randInt(1, 20);
    answer = a + b;
  } else if (op === '-') {
    a = randInt(2, 20);
    b = randInt(1, a); // keep answers non-negative
    answer = a - b;
  } else {
    a = randInt(2, 9);
    b = randInt(2, 9);
    answer = a * b;
  }
  return { prompt: `${a} ${op} ${b}`, answer };
}

function distractors(answer, count) {
  const wrong = new Set();
  while (wrong.size < count) {
    const d = answer + pick([-1, 1]) * randInt(1, 5);
    if (d >= 0 && d !== answer) wrong.add(d);
  }
  return [...wrong];
}

function makeQuestion(type) {
  const { prompt, answer } = mathProblem();
  if (type === 'choice') {
    const options = shuffle([answer, ...distractors(answer, 3)]).map(String);
    return { type, prompt, answer: String(answer), options, correctIndex: options.indexOf(String(answer)) };
  }
  return { type, prompt, answer: String(answer), inputHint: 'number' };
}

/** Builds the questions for one round, avoiding repeats within the round. */
export function buildRound(round) {
  const questions = [];
  const seen = new Set();
  while (questions.length < round.questions) {
    const q = makeQuestion(round.type);
    if (seen.has(q.prompt)) continue;
    seen.add(q.prompt);
    questions.push(q);
  }
  return questions;
}

// Free answers ignore spacing, capitalization, accents and punctuation:
// "Ice-Cream!" counts as "ice cream".
const compact = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Numbers compare by value ("07", "7.0", "1,000", "- 3"), keeping their minus
// signs and decimal points, which compact() would strip.
const asNumber = (s) => {
  const t = String(s).replace(/[\s,]/g, '');
  return t !== '' && Number.isFinite(Number(t)) ? Number(t) : NaN;
};

export function isCorrect(question, answer) {
  if (answer === null || answer === undefined) return false;
  if (question.type === 'choice') return answer === question.correctIndex;
  const a = asNumber(answer), b = asNumber(question.answer);
  if (!Number.isNaN(a) && !Number.isNaN(b)) return a === b;
  const given = compact(answer);
  return given !== '' && given === compact(question.answer);
}
