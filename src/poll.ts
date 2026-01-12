// src/poll.ts
// Robust poll runner: handles missing poll spec gracefully and supports automatic mode selection.
// If runPoll() is called without an explicit sub-mode, the function decides whether to post a new poll
// or close an existing one based on whether a poll spec exists and its status.

import { xClient } from "./xClient.js";
import { postTweet } from "./poster.js";
import { log } from "./logger.js";
import { loadPollSpec, savePollSpec, PollSpec, closeAndApply } from "./pollApply.js";

function isoPlusHours(hours: number) {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

function makeDefaultPollSpec(): PollSpec {
  const now = new Date().toISOString();
  return {
    version: 1,
    pollId: String(Date.now()),
    createdAt: now,
    closesAt: isoPlusHours(24),
    status: "open",
    options: [
      { id: 1, text: "Add rule: no emojis", action: "ADD_RULE:No emojis." },
      { id: 2, text: "Add rule: no hashtags unless needed", action: "ADD_RULE:No hashtags unless absolutely needed." },
      { id: 3, text: "Remove rule: format-short", action: "REMOVE_RULE:format-short" },
      { id: 4, text: "Remove rule: end-ribbit", action: "REMOVE_RULE:end-ribbit" },
      { id: 5, text: "Add rule: replies more aggressive", action: "ADD_RULE:Replies should be more aggressive and punchy." },
    ],
  };
}

/**
 * Take the first digit 1..5 from the text (and count only that).
 * "I'm voting for number two because..." -> finds 2 if the text contains "2"
 * If someone writes "2 2 2 2" -> it's still a single vote (deduped per user).
 */
function extractVote(text: string): number | null {
  const m = text.match(/[1-5]/);
  if (!m) return null;
  const n = Number(m[0]);
  if (n >= 1 && n <= 5) return n;
  return null;
}

async function postPollTweet(spec: PollSpec) {
  const lines: string[] = [];
  lines.push("Weekly change vote. Comment a number 1–5.");
  lines.push("");
  for (const o of spec.options) {
    lines.push(`${o.id}) ${o.text}`);
  }
  lines.push("");
  lines.push("One vote per account. Voting closes in 24h. ribbit.");

  const text = lines.join("\n");

  const tweetId = await postTweet(text);
  spec.tweetId = tweetId;
  savePollSpec(spec);

  log("INFO", "Poll posted", { tweetId, pollId: spec.pollId, closesAt: spec.closesAt });
  return tweetId;
}

/**
 * Collect replies to the tweet (comments) and count votes:
 * - 1 vote per userId
 * - only the first valid vote per user counts
 */
async function collectVotes(tweetId: string) {
  // twitter-api-v2: you can search replies like this:
  // we search tweets with "conversation_id:tweetId"
  const query = `conversation_id:${tweetId}`;

  const paginator = await xClient.v2.search(query, {
    "tweet.fields": ["author_id", "conversation_id", "created_at"],
    max_results: 100,
  });

  const seen = new Set<string>(); // author_id
  const counts = new Map<number, number>();
  const perUser = new Map<string, number>();

  for await (const tw of paginator) {
    const author = tw.author_id;
    if (!author) continue;
    if (seen.has(author)) continue;

    const vote = extractVote(tw.text ?? "");
    if (!vote) continue;

    seen.add(author);
    perUser.set(author, vote);
    counts.set(vote, (counts.get(vote) ?? 0) + 1);
  }

  return { counts, perUser, totalVoters: seen.size };
}

function pickWinner(counts: Map<number, number>): number | null {
  let best: number | null = null;
  let bestCount = -1;

  for (const [k, v] of counts.entries()) {
    if (v > bestCount) {
      best = k;
      bestCount = v;
    } else if (v === bestCount && best !== null) {
      // Tiebreak: lower number wins
      if (k < best) best = k;
    }
  }

  return best;
}

/**
 * Run poll logic.
 * - If `mode` is provided it must be "poll_post" or "poll_close".
 * - If `mode` is omitted, the function decides:
 *    * if no poll spec exists or it is not open => do poll_post
 *    * otherwise => do poll_close
 *
 * This makes calling `runPoll()` from `index.ts` safe.
 */
export async function runPoll(mode?: "poll_post" | "poll_close") {
  // If mode is not specified, decide based on existing poll spec.
  if (!mode) {
    const existing = loadPollSpec();
    if (!existing || existing.status !== "open") {
      mode = "poll_post";
    } else {
      mode = "poll_close";
    }
  }

  if (mode === "poll_post") {
    const existing = loadPollSpec();
    if (existing && existing.status === "open") {
      log("WARN", "Poll already open; skip posting", { pollId: existing.pollId, tweetId: existing.tweetId });
      return;
    }
    const spec = makeDefaultPollSpec();
    await postPollTweet(spec);
    return;
  }

  // mode === "poll_close"
  const spec = loadPollSpec();
  if (!spec) {
    // Graceful handling: do not throw here, just log and exit.
    log("WARN", "No poll spec found to close; nothing to do.");
    return;
  }
  if (spec.status !== "open") {
    log("INFO", "Poll already closed; skip", { pollId: spec.pollId });
    return;
  }
  if (!spec.tweetId) {
    log("ERROR", "Poll is missing tweetId; cannot collect votes", { pollId: spec.pollId });
    return;
  }

  // Check close time
  const now = Date.now();
  const closeAt = new Date(spec.closesAt).getTime();
  if (now < closeAt) {
    log("INFO", "Poll not ready to close yet", { closesAt: spec.closesAt });
    return;
  }

  const { counts, totalVoters } = await collectVotes(spec.tweetId);
  const winner = pickWinner(counts);

  log("INFO", "Poll votes counted", {
    pollId: spec.pollId,
    tweetId: spec.tweetId,
    totalVoters,
    counts: Object.fromEntries([...counts.entries()].sort((a, b) => a[0] - b[0])),
    winner,
  });

  if (!winner) {
    // No votes — close without action
    spec.status = "closed";
    spec.winner = {
      optionId: -1,
      decidedAt: new Date().toISOString(),
      details: { ok: false, reason: "No votes" },
    };
    savePollSpec(spec);
    return;
  }

  closeAndApply(spec, winner);
}
