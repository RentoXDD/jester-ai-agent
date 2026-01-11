export function extractVote(text: string, maxOption = 5): number | null {
  const match = text.match(/\b([1-5])\b/);
  if (!match) return null;

  const vote = Number(match[1]);
  if (vote >= 1 && vote <= maxOption) return vote;

  return null;
}

export function countVotesFirstOnly(
  comments: { userId: string; text: string }[],
  maxOption = 5
) {
  const votedUsers = new Set<string>();
  const voteCounts = new Map<number, number>();

  for (const c of comments) {
    if (votedUsers.has(c.userId)) continue;

    const vote = extractVote(c.text, maxOption);
    if (!vote) continue;

    votedUsers.add(c.userId);
    voteCounts.set(vote, (voteCounts.get(vote) ?? 0) + 1);
  }

  return voteCounts;
}

export function pickWinner(votes: Map<number, number>) {
  let winner: number | null = null;
  let bestCount = -1;

  for (const [option, count] of votes.entries()) {
    if (count > bestCount) {
      winner = option;
      bestCount = count;
    }
  }

  return { winner, bestCount };
}
