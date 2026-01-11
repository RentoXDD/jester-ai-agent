// src/dailyPost.ts
import { MemoryStore } from "./memoryStore.js";
import { generateTweet } from "./generator.js";
import { validateOutput, finalizeTweet } from "./guardrails.js";
import { postTweet } from "./poster.js";
import { log } from "./logger.js";
import { normalizeWhitespace, ensureRibbit } from "./text.js";

type TopicPick = { topic: string; context: string };

function pickTopic(): TopicPick {
  const topics: TopicPick[] = [
    { topic: "crypto market mood", context: "Make a joke about traders losing their mind over tiny price moves." },
    { topic: "pump.fun chaos", context: "Make a joke about pump.fun launches being pure circus energy." },
    { topic: "chart addiction", context: "Make a joke about staring at charts 24/7 like it's a life purpose." },
    { topic: "diamond hands pain", context: "Make a joke about holding bags through dumps and calling it 'strategy'." },
    { topic: "CTO community drama", context: "Make a joke about community governance wars and 'who's really in charge'." },
    { topic: "memecoin delusion", context: "Make a joke about people thinking their coin will change history." },
  ];
  return topics[Math.floor(Math.random() * topics.length)];
}

function clampTweet(t: string, maxLen: number): string {
  if (t.length <= maxLen) return t;

  // leave space for "… ribbit."
  const suffix = " ribbit.";
  const hard = Math.max(0, maxLen - suffix.length - 1); // 1 for ellipsis char
  let cut = t.slice(0, hard).trimEnd();

  // avoid cutting to empty
  if (!cut) cut = t.slice(0, maxLen).trimEnd();

  // ensure final punctuation is clean
  if (cut.endsWith(".")) cut = cut.slice(0, -1).trimEnd();

  return `${cut}…${suffix}`;
}

export async function runDailyPost(): Promise<void> {
  const store = new MemoryStore();

  const recentPosts = store.getRecentPosts(15).map((p) => p.content);
  const successPatterns = store.getPatterns("success", 10);
  const failPatterns = store.getPatterns("avoid", 10);

  const { topic, context } = pickTopic();

  log("INFO", "Generating daily post", { topic });

  const MAX_LEN = 260;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const raw = await generateTweet({
        topic,
        context,
        successPatterns,
        failPatterns,
        recentPosts,
      });

      // Normalize whitespace + ensure ribbit, then finalize/guardrails
      let tweet = normalizeWhitespace(raw);
      tweet = ensureRibbit(tweet);
      tweet = finalizeTweet(tweet);

      // Hard length clamp (still keep ribbit.)
      tweet = clampTweet(tweet, MAX_LEN);

      const check = validateOutput(tweet);
      if (!check.ok) {
        log("WARN", "Generated tweet rejected", { attempt, reason: check.reason, tweet });
        continue;
      }

      // Post to X (this must throw if tokens invalid / API fails)
      const tweetId = await postTweet(tweet);

      // Persist memory
      store.addPost({ tweet_id: tweetId, content: tweet, topic, context });

      log("INFO", "Daily post published", { tweetId, length: tweet.length });
      return;
    } catch (err: any) {
      lastError = err?.message || String(err);
      log("ERROR", "Failed daily post attempt", { attempt, error: lastError });
    }
  }

  // ❗CRITICAL: make the job fail (so Actions doesn't show ✅ Success)
  throw new Error(`Daily post failed after retries${lastError ? `: ${lastError}` : ""}`);
}
