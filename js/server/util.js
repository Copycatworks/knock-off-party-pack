/** Map of playerId -> score, to a ranked list. Ties share a rank. */
export function rankScores(scores) {
  const sorted = [...scores].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
  return sorted.map((s) => ({ ...s, rank: sorted.findIndex((o) => o.score === s.score) + 1 }));
}
