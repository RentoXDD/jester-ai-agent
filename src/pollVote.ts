export type VoteResult = {
  winner: number;
  counts: Record<number, number>;
  voters: number;
};

export function extractFirstVote(text: string): number | null {
  // Find the first digit 1–5 anywhere:
  // "I'm voting for 2 because..." -> 2
  // "2 2 2 2" -> 2 (one vote)
  const m = text.match(/[1-5]/);
  if (!m) return null;
  return parseInt(m[0], 10);
}

export function tallyVotes(
  comments: { user_id: string; text: string }[],
  maxOption: number = 5
): VoteResult {
  const seen = new Set<string>(); // 1 user = 1 vote
  const counts: Record<number, number> = {};
  for (let i = 1; i <= maxOption; i++) counts[i] = 0;

  for (const c of comments) {
    if (!c.user_id) continue;
    if (seen.has(c.user_id)) continue; // ignore subsequent comments by the same user
    const v = extractFirstVote(c.text);
    if (!v) continue;
    if (v < 1 || v > maxOption) continue;
    seen.add(c.user_id);
    counts[v] += 1;
  }

  let winner = 1;
  let best = -1;
  for (let i = 1; i <= maxOption; i++) {
    if (counts[i] > best) {
      best = counts[i];
      winner = i;
    }
  }

  return { winner, counts, voters: seen.size };
}
