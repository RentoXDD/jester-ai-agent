import { extractVote } from "./pollParser.js";

export type Vote = {
  userId: string;
  option: number;
};

export function collectVotes(replies: any[], maxOption = 5): Vote[] {
  const seenUsers = new Set<string>();
  const votes: Vote[] = [];

  for (const r of replies) {
    const userId = r.author_id;
    const text = r.text || "";

    if (!userId || seenUsers.has(userId)) continue;

    const option = extractVote(text, maxOption);
    if (!option) continue;

    seenUsers.add(userId);
    votes.push({ userId, option });
  }

  return votes;
}

export function countVotes(votes: Vote[], maxOption = 5) {
  const counts = Array(maxOption).fill(0);

  for (const v of votes) {
    if (v.option >= 1 && v.option <= maxOption) {
      counts[v.option - 1]++;
    }
  }

  return counts;
}
