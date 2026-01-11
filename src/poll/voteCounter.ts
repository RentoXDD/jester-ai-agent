import { xClient } from "../xClient.js";
import { log } from "../logger.js";

function extractVote(text: string): number | null {
  // Find the first digit 1..5
  const m = text.match(/[1-5]/);
  if (!m) return null;
  return parseInt(m[0], 10);
}

export async function countVotesForTweet(pollTweetId: string) {
  // Here we collect replies (comments) to the tweet.
  // Twitter API v2: search_recent_tweets can be used via conversation_id
  // But it's more convenient to use search:
  // query: `conversation_id:${pollTweetId} is:reply`

  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const voterSet = new Set<string>();

  let nextToken: string | undefined = undefined;
  let totalReplies = 0;

  while (true) {
    const res = await xClient.v2.search(`conversation_id:${pollTweetId} is:reply`, {
      "tweet.fields": ["author_id", "created_at", "conversation_id"],
      max_results: 100,
      next_token: nextToken,
    });

    const tweets = res.data?.data || [];
    totalReplies += tweets.length;

    for (const t of tweets) {
      const authorId = (t as any).author_id as string;
      const text = (t as any).text as string;

      if (!authorId) continue;

      // If the user already voted — ignore
      if (voterSet.has(authorId)) continue;

      const vote = extractVote(text);
      if (!vote) continue;

      voterSet.add(authorId);
      counts[vote] = (counts[vote] || 0) + 1;
    }

    nextToken = (res.data as any)?.meta?.next_token;
    if (!nextToken) break;
  }

  const totalVoters = voterSet.size;

  log("INFO", "Poll votes counted", { pollTweetId, totalReplies, totalVoters, counts });

  return { counts, totalVoters, totalReplies };
}

export function pickWinner(counts: Record<number, number>) {
  let winner = 1;
  let max = -1;

  for (const k of [1, 2, 3, 4, 5]) {
    const v = counts[k] || 0;
    if (v > max) {
      max = v;
      winner = k;
    }
  }

  return winner;
}
