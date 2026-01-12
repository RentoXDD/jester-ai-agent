// src/poll.ts
// Two-stage weekly poll flow with jester-voiced stage1 announcement.
// 1) Stage 1: jester announcement (styled), pin it, wait 24h.
// 2) After 24h: collect replies, choose top 5 by likes -> Stage 2 options.
// 3) Stage 2: post second-stage vote (pin), wait 24h.
// 4) After 24h: collect votes, pick winner, announce final, pin final message.
// Poll lifecycle stored in data/poll.json via pollApply.savePollSpec.

import { xClient } from "./xClient.js";
import { postTweet, pinTweet } from "./poster.js";
import { log } from "./logger.js";
import { loadPollSpec, savePollSpec, PollSpec, applyWinningOption } from "./pollApply.js";

function isoPlusHours(hours: number) {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

// jester-style announcement generator
function jesterizeAnnouncement(): string {
  // Three jester-voiced templates. Each ends with question/exclamation marks and 'ribbit'.
  const templates = [
    // Playful & cheeky
    [
      "Hearken, merry souls! The Jester proclaims a week of rule-craft —",
      "this week we shall tinker with our rules and see what mischief fits best.",
      "Speak forth your idea below and let the crowd decide!",
      "❓❓❓❗❗❗",
      "ribbit"
    ].join("\n\n"),

    // Short, punchy, very jester-like
    [
      "Hark! The Jester says: time to meddle with the rules this week!",
      "Bring your boldest notion — one reply, one voice, one laugh.",
      "Top ideas move onward — make your pitch!",
      "❓❓❓❗❗❗",
      "ribbit"
    ].join("\n\n"),

    // Theatrical / ironic
    [
      "Oh fine folk, gather round! The Jester doth proclaim:",
      "\"This week shall see our rules remade — or left to their folly.\"",
      "Propose your change below; let the jolly crowd sort the winners.",
      "❓❓❓❗❗❗",
      "ribbit"
    ].join("\n\n")
  ];

  // Choose a template at random for variety
  const idx = Math.floor(Math.random() * templates.length);
  return templates[idx];
}

/**
 * Post an announcement tweet and attempt to pin it.
 */
async function postStage1Announcement(spec: PollSpec) {
  const text = jesterizeAnnouncement();
  const tweetId = await postTweet(text);
  spec.stage1 = {
    tweetId,
    createdAt: new Date().toISOString(),
    closesAt: isoPlusHours(24),
    status: "open",
  };
  savePollSpec(spec);
  // try to pin; log failure but continue
  const pinned = await pinTweet(tweetId).catch(() => false);
  if (!pinned) log("WARN", "Automatic pin failed; consider pinning manually.", { tweetId });
  log("INFO", "Stage1 announcement posted", { tweetId, pollId: spec.pollId });
  return tweetId;
}

/**
 * Collect replies for a tweet and return array of reply objects:
 * { id, text, author_id, like_count, created_at }
 */
async function collectRepliesWithLikes(tweetId: string) {
  const query = `conversation_id:${tweetId}`;
  // include public_metrics to get like_count
  const paginator = await xClient.v2.search(query, {
    "tweet.fields": ["author_id", "conversation_id", "created_at", "public_metrics", "in_reply_to_user_id"],
    max_results: 100,
  });

  const replies: any[] = [];
  for await (const tw of paginator) {
    // only consider direct replies in the conversation (exclude the root tweet)
    if (String(tw.id) === String(tweetId)) continue;
    // exclude retweets or non-text items
    replies.push({
      id: tw.id,
      text: tw.text ?? "",
      author_id: tw.author_id ?? "",
      like_count: (tw.public_metrics?.like_count ?? 0),
      created_at: tw.created_at ?? "",
    });
  }

  return replies;
}

/**
 * Select top N replies by like_count, dedupe by author (first-come)
 */
function pickTopReplies(replies: any[], n: number) {
  // Sort by like_count desc, created_at asc for tiebreak
  const sorted = replies.slice().sort((a, b) => {
    if (b.like_count !== a.like_count) return b.like_count - a.like_count;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const chosen: any[] = [];
  const seenAuthors = new Set<string>();
  for (const r of sorted) {
    if (seenAuthors.has(r.author_id)) continue;
    // ignore empty or too short replies (optional filter)
    if (!r.text || r.text.trim().length < 3) continue;
    chosen.push(r);
    seenAuthors.add(r.author_id);
    if (chosen.length >= n) break;
  }
  return chosen;
}

/**
 * Build stage2 options from replies (map to PollOption shape with CUSTOM action).
 */
function buildStage2OptionsFromReplies(replies: any[]) {
  return replies.map((r, idx) => ({
    id: idx + 1,
    text: r.text.length > 280 ? r.text.slice(0, 275) + "…" : r.text,
    action: `CUSTOM:${r.text}`,
    authorId: r.author_id,
  }));
}

/**
 * Post the stage2 poll (compact multiline) and pin it.
 */
async function postStage2Poll(spec: PollSpec) {
  const options = spec.stage2?.options ?? [];
  const header = "Final vote — choose one of the top ideas below! Comment the number to vote. Closes in 24h. ribbit.\n\n";
  const lines = options.map(o => `${o.id}) ${o.text}`);
  const text = header + lines.join("\n\n");
  const tweetId = await postTweet(text);
  spec.stage2 = spec.stage2 ?? { createdAt: new Date().toISOString(), closesAt: isoPlusHours(24), status: "open", tweetId: tweetId, options };
  spec.stage2.tweetId = tweetId;
  spec.stage2.createdAt = new Date().toISOString();
  spec.stage2.closesAt = isoPlusHours(24);
  spec.stage2.status = "open";
  savePollSpec(spec);
  const pinned = await pinTweet(tweetId).catch(() => false);
  if (!pinned) log("WARN", "Automatic pin of stage2 failed; please pin manually", { tweetId });
  log("INFO", "Stage2 poll posted", { tweetId, pollId: spec.pollId });
  return tweetId;
}

/**
 * Collect votes for stage2 (replies to the stage2 tweet). Return winner id (1..N) or null
 */
async function collectVotesForStage2(tweetId: string, optionIds: number[]) {
  const query = `conversation_id:${tweetId}`;
  const paginator = await xClient.v2.search(query, {
    "tweet.fields": ["author_id", "conversation_id", "created_at"],
    max_results: 100,
  });

  const seen = new Set<string>(); // author dedupe
  const counts = new Map<number, number>();
  for (const id of optionIds) counts.set(id, 0);

  for await (const tw of paginator) {
    const author = tw.author_id;
    if (!author) continue;
    if (seen.has(author)) continue;
    const text = tw.text ?? "";
    const m = text.match(/\b([1-5])\b/);
    if (!m) continue;
    const n = Number(m[1]);
    if (!optionIds.includes(n)) continue;
    seen.add(author);
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }

  // pick winner
  let best: number | null = null;
  let bestCount = -1;
  for (const [k, v] of counts.entries()) {
    if (v > bestCount) {
      best = k;
      bestCount = v;
    } else if (v === bestCount && best !== null) {
      if (k < best) best = k;
    }
  }
  return { winner: best, counts: Object.fromEntries([...counts.entries()]) , totalVoters: seen.size};
}

/**
 * Final announcement: post and pin the final message describing the chosen rule or "no change".
 */
async function postFinalAnnouncement(spec: PollSpec, winner?: { optionId: number; action?: string; details?: any } | null) {
  let text: string;
  if (!winner || !spec.stage2?.options) {
    text = "The final vote concluded: no decisive change. The rules remain as they are. ribbit.";
  } else {
    const chosen = spec.stage2.options.find(o => o.id === winner.optionId);
    if (!chosen) {
      text = "The final vote concluded, but the chosen option could not be resolved. No changes applied.";
    } else {
      // If action is known (ADD_RULE / REMOVE_RULE) we can phrase the announcement accordingly.
      const act = (chosen.action ?? "").trim();
      if (act.startsWith("ADD_RULE:")) {
        const ruleText = act.substring("ADD_RULE:".length);
        text = `Final result: Add rule — ${ruleText}\n\nThis rule is now in effect. ribbit.`;
      } else if (act.startsWith("REMOVE_RULE:")) {
        const ruleText = act.substring("REMOVE_RULE:".length);
        text = `Final result: Remove rule — ${ruleText}\n\nThis rule has been removed. ribbit.`;
      } else if (act.startsWith("CUSTOM:")) {
        const payload = act.substring("CUSTOM:".length);
        text = `Final result: community chose this proposal:\n\n"${payload}"\n\nThis will be considered as the week's rule change (or no-change if moderators decide). ribbit.`;
      } else {
        text = `Final result: ${chosen.text}\n\nThis was selected in the final vote. ribbit.`;
      }
    }
  }

  const tweetId = await postTweet(text);
  // Try to pin final message (recommended)
  const pinned = await pinTweet(tweetId).catch(() => false);
  if (!pinned) log("WARN", "Automatic pin of final announcement failed; please pin manually", { tweetId });
  // Save final
  spec.final = spec.final ?? {};
  spec.final.decidedAt = new Date().toISOString();
  if (winner) {
    spec.final.winner = {
      optionId: winner.optionId,
      action: (spec.stage2?.options?.find(o => o.id === winner.optionId)?.action) ?? undefined,
      details: winner.details ?? {},
    };
  } else {
    spec.final.winner = { optionId: -1, action: "NO_CHANGE", details: {} };
  }
  savePollSpec(spec);
  log("INFO", "Final announcement posted", { tweetId, pollId: spec.pollId });
  return tweetId;
}

/**
 * The main runPoll orchestration for stages.
 */
export async function runPoll(mode?: "poll_post" | "poll_close") {
  // We will use the persisted spec to determine which stage we're in
  let spec = loadPollSpec();

  // If mode is explicitly provided, map to our flow:
  if (mode === "poll_post") {
    // Force a new Stage1 announcement (start a fresh poll cycle)
    spec = {
      version: 1,
      pollId: String(Date.now()),
      createdAt: new Date().toISOString(),
    };
    savePollSpec(spec);
    await postStage1Announcement(spec);
    return;
  }

  // If no spec yet, create a new spec and start stage1
  if (!spec || (!spec.stage1 && !spec.stage2 && !spec.final)) {
    spec = {
      version: 1,
      pollId: String(Date.now()),
      createdAt: new Date().toISOString(),
    };
    savePollSpec(spec);
    await postStage1Announcement(spec);
    return;
  }

  // If we have stage1 open and it's time to close it -> collect replies and create stage2
  if (spec.stage1 && spec.stage1.status === "open") {
    const now = Date.now();
    const closeAt = new Date(spec.stage1.closesAt ?? "").getTime();
    if (isNaN(closeAt) || now >= closeAt) {
      // collect replies
      const tweetId = spec.stage1.tweetId!;
      const replies = await collectRepliesWithLikes(tweetId);
      log("INFO", "Collected replies for stage1", { pollId: spec.pollId, repliesCount: replies.length });

      const top = pickTopReplies(replies, 5);
      if (top.length === 0) {
        // No replies; close stage1 and repost announcement (or mark closed and leave)
        spec.stage1.status = "closed";
        savePollSpec(spec);
        log("INFO", "No replies found for stage1; closing without advancing", { pollId: spec.pollId });
        return;
      }

      // Build stage2 options
      const options = buildStage2OptionsFromReplies(top);
      spec.stage1.status = "closed";
      spec.stage2 = {
        tweetId: undefined,
        createdAt: new Date().toISOString(),
        closesAt: isoPlusHours(24),
        status: "open",
        options,
      };
      savePollSpec(spec);
      await postStage2Poll(spec);
      return;
    } else {
      log("INFO", "Stage1 still open; nothing to do", { pollId: spec.pollId, closesAt: spec.stage1.closesAt });
      return;
    }
  }

  // If stage2 exists and is open and it's time to close -> count votes and finalize
  if (spec.stage2 && spec.stage2.status === "open") {
    const now = Date.now();
    const closeAt = new Date(spec.stage2.closesAt ?? "").getTime();
    if (isNaN(closeAt) || now >= closeAt) {
      const tweetId = spec.stage2.tweetId!;
      const optionIds = (spec.stage2.options ?? []).map(o => o.id);
      const { winner, counts, totalVoters } = await collectVotesForStage2(tweetId, optionIds);
      log("INFO", "Stage2 votes counted", { pollId: spec.pollId, counts, totalVoters, winner });
      // close stage2
      spec.stage2.status = "closed";
      spec.final = spec.final ?? {};
      if (!winner) {
        spec.final.winner = { optionId: -1, action: "NO_CHANGE", details: { ok: false } };
        savePollSpec(spec);
        // announce no-change
        await postFinalAnnouncement(spec, null);
        return;
      }
      // Build winner details
      const winnerOption = spec.stage2.options?.find(o => o.id === winner) ?? null;
      const applied = applyWinningOption(spec, winner ?? -1);
      spec.final.winner = {
        optionId: winner ?? -1,
        action: winnerOption?.action,
        details: applied,
      };
      savePollSpec(spec);
      // announce final and pin
      await postFinalAnnouncement(spec, spec.final.winner as any);
      return;
    } else {
      log("INFO", "Stage2 still open; nothing to do", { pollId: spec.pollId, closesAt: spec.stage2.closesAt });
      return;
    }
  }

  // If both stages closed and final exists, start a new cycle (weekly)
  if (spec.final && spec.stage1?.status === "closed" && spec.stage2?.status === "closed") {
    // Reset for next week
    const newSpec: PollSpec = {
      version: 1,
      pollId: String(Date.now()),
      createdAt: new Date().toISOString(),
    };
    savePollSpec(newSpec);
    await postStage1Announcement(newSpec);
    return;
  }

  // If stage1 not present (fallback) start it
  if (!spec.stage1) {
    await postStage1Announcement(spec);
    return;
  }

  log("INFO", "No action required for runPoll at this time", { pollId: spec.pollId });
}
