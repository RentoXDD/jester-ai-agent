// src/dailyPost.ts
import { MemoryStore } from "./memoryStore.js";
import { generateTweet } from "./generator.js";
import { validateOutput, finalizeTweet } from "./guardrails.js";
import { postTweetWithMedia } from "./poster.js";
import { log } from "./logger.js";
import { normalizeWhitespace, ensureRibbit } from "./text.js";
import { generateImageForPost } from "./imageGenerator.js";

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

  const suffix = " ribbit.";
  const hard = Math.max(0, maxLen - suffix.length - 1);
  let cut = t.slice(0, hard).trimEnd();

  if (!cut) cut = t.slice(0, maxLen).trimEnd();

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

      let tweet = normalizeWhitespace(raw);
      tweet = ensureRibbit(tweet);
      tweet = finalizeTweet(tweet);

      tweet = clampTweet(tweet, MAX_LEN);

      const check = validateOutput(tweet);
      if (!check.ok) {
        log("WARN", "Generated tweet rejected", { attempt, reason: check.reason, tweet });
        continue;
      }

      // Try generate image (best-effort). If it fails, post text-only.
      let imageBuffer: Buffer | undefined;
      try {
        imageBuffer = await generateImageForPost(topic, context);
      } catch (imgErr: any) {
        log("WARN", "Image generation failed, will post text-only", { error: String(imgErr?.message ?? imgErr) });
        imageBuffer = undefined;
      }

      const tweetId = await postTweetWithMedia(tweet, imageBuffer);

      // Persist memory
      store.addPost({ tweet_id: tweetId, content: tweet, topic, context });

      log("INFO", "Daily post published", { tweetId, length: tweet.length });
      return;
    } catch (err: any) {
      lastError = err?.message || String(err);
      log("ERROR", "Failed daily post attempt", { attempt, error: lastError });
    }
  }

  throw new Error(`Daily post failed after retries${lastError ? `: ${lastError}` : ""}`);
}
