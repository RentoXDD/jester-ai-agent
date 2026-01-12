// src/poster.ts
// X/Twitter posting helpers with optional pin support.
// Tries v1 method for pinning via twitter-api-v2; if pinning fails, we log and continue.

import { xClient } from "./xClient.js";
import { log } from "./logger.js";

export async function postTweet(text: string, replyToId?: string): Promise<string> {
  try {
    let res;
    // twitter-api-v2 v2.tweet accepts an object { text, reply: { in_reply_to_tweet_id } }
    if (replyToId) {
      res = await xClient.v2.tweet({ text, reply: { in_reply_to_tweet_id: replyToId } });
    } else {
      res = await xClient.v2.tweet({ text });
    }

    const id = res.data.id;
    log("INFO", "Tweet posted", { id });
    return id;
  } catch (err: any) {
    log("ERROR", "Failed to post tweet", { error: String(err?.message ?? err) });
    throw err;
  }
}

/**
 * Attempt to pin a tweet for the authenticating user.
 * Implementation tries v1 endpoints (twitter-api-v2 exposes some v1 methods).
 * If pinning is not supported by API/credentials, function logs and returns false.
 */
export async function pinTweet(tweetId: string): Promise<boolean> {
  try {
    // Try twitter-api-v2 convenience (if available). Many wrappers include v1.pinTweet
    const clientAny: any = xClient as any;
    if (clientAny.v1 && typeof clientAny.v1.pinTweet === "function") {
      await clientAny.v1.pinTweet(tweetId);
      log("INFO", "Tweet pinned (v1.pinTweet)", { tweetId });
      return true;
    }

    // Some clients support doing POST to a pin-like endpoint.
    // Attempt common pattern: POST account/pin_tweet (may not exist).
    if (clientAny.v1 && typeof clientAny.v1.post === "function") {
      try {
        await clientAny.v1.post("account/pin_tweet", { tweet_id: tweetId });
        log("INFO", "Tweet pinned via account/pin_tweet", { tweetId });
        return true;
      } catch (err) {
        // ignore and try alternative
      }
    }

    // If we reach here, pinning is not supported or unknown endpoint.
    log("WARN", "Pin tweet not supported programmatically. Please pin manually if needed.", { tweetId });
    return false;
  } catch (err: any) {
    log("ERROR", "Failed to pin tweet", { tweetId, error: String(err?.message ?? err) });
    return false;
  }
}
