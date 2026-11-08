// Deciding which free-text answers count as "the same" for Match to Hatch.
//
// Answers are normalized (case, accents, punctuation, "the"/"a", simple plurals,
// number words), then two answers match when they're equal, differ by a typo or
// two, or one is contained in the other ("Lincoln" and "Abraham Lincoln").
// Matches chain, so if A matches B and B matches C, all three are one group.

const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'my']);
const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

function singular(word) {
  if (word.length <= 3 || /\d/.test(word)) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (/(s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) return word.slice(0, -1);
  return word;
}

/** "The Apples!" -> ['apple'] */
export function words(text) {
  const all = String(text)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  // Filler words are dropped, unless they're the whole answer ("a", "The").
  const kept = all.filter((w) => !STOPWORDS.has(w));
  return (kept.length ? kept : all).map((w) => (NUMBERS.includes(w) ? String(NUMBERS.indexOf(w)) : singular(w)));
}

function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

/** Same word, allowing one typo in words of 5+ letters. */
const sameWord = (a, b) => a === b || (Math.min(a.length, b.length) >= 5 && editDistance(a, b) <= 1);

export function answersMatch(a, b) {
  const wa = words(a), wb = words(b);
  if (!wa.length || !wb.length) return false;
  const ca = wa.join(''), cb = wb.join('');
  if (ca === cb) return true;
  // Typos: one edit for short answers, two for longer ones.
  const longest = Math.max(ca.length, cb.length);
  if (Math.min(ca.length, cb.length) >= 4 && editDistance(ca, cb) <= (longest >= 8 ? 2 : 1)) return true;
  // One answer's words all appear in the other ("lincoln" / "abraham lincoln").
  const [small, big] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  return small.every((w) => (w.length >= 3 || /^\d+$/.test(w)) && big.some((x) => sameWord(w, x)));
}

/**
 * Groups answers that match. `answers` is a Map of playerId -> text.
 * Returns [{ answer, ids, matched }], matched groups (2+ players) first.
 */
export function groupAnswers(answers) {
  const entries = [...answers];
  const parent = entries.map((_, i) => i);
  const root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (root(i) !== root(j) && answersMatch(entries[i][1], entries[j][1])) parent[root(j)] = root(i);
    }
  }
  const groups = new Map();
  entries.forEach(([id, text], i) => {
    if (!groups.has(root(i))) groups.set(root(i), { ids: [], texts: [] });
    groups.get(root(i)).ids.push(id);
    groups.get(root(i)).texts.push(text);
  });
  return [...groups.values()]
    .map(({ ids, texts }) => ({ answer: mostCommon(texts), ids, matched: ids.length >= 2 }))
    .sort((a, b) => b.ids.length - a.ids.length);
}

/** The spelling most of the group used (the first one on a tie). */
function mostCommon(texts) {
  const counts = new Map();
  for (const t of texts) counts.set(t.toLowerCase(), (counts.get(t.toLowerCase()) ?? 0) + 1);
  const best = Math.max(...counts.values());
  return texts.find((t) => counts.get(t.toLowerCase()) === best);
}
