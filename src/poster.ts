// src/poster.ts
// X/Twitter posting helpers with optional pin support.

import { xClient } from "./xClient.js";
import { log } from "./logger.js";

/**
 * Post text-only tweet (existing behavior)
 */
export async function postTweet(text: string, replyToId?: string): Promise<string> {
  try {
    let res;
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
 * Post tweet with media (image). Uploads via v1 endpoint if available.
 * Falls back to text-only if media upload is not supported or fails.
 */
export async function postTweetWithMedia(text: string, imageBuffer?: Buffer, replyToId?: string): Promise<string> {
  try {
    if (!imageBuffer) return await postTweet(text, replyToId);

    const clientAny: any = xClient as any;
    // prefer v1.uploadMedia convenience
    if (clientAny.v1 && typeof clientAny.v1.uploadMedia === "function") {
      const mediaId = await clientAny.v1.uploadMedia(imageBuffer, { mimeType: "image/png" });
      // v2.tweet with media ids:
      const res = await xClient.v2.tweet({
        text,
        media: { media_ids: [mediaId] },
        reply: replyToId ? { in_reply_to_tweet_id: replyToId } : undefined,
      });
      const id = res.data.id;
      log("INFO", "Tweet with media posted (v1.uploadMedia)", { id });
      return id;
    }

    // fallback: some clients support v1.post('media/upload') or other patterns
    if (clientAny.v1 && typeof clientAny.v1.post === "function") {
      try {
        // attempt common automatic1111-like upload pattern (may not exist)
        const resUpload = await clientAny.v1.post("media/upload", {
          media: imageBuffer.toString("base64"),
        });
        const mediaId = resUpload?.media_id_string || resUpload?.media_id;
        if (mediaId) {
          const res = await xClient.v2.tweet({
            text,
            media: { media_ids: [mediaId] },
            reply: replyToId ? { in_reply_to_tweet_id: replyToId } : undefined,
          });
          const id = res.data.id;
          log("INFO", "Tweet with media posted (v1.post)", { id });
          return id;
        }
      } catch (e) {
        // ignore and fallback to text-only
      }
    }

    // Otherwise: upload not supported -> fallback to text-only
    log("WARN", "Media upload not supported by client. Posting text-only.", {});
    return await postTweet(text, replyToId);
  } catch (err: any) {
    log("ERROR", "Failed to post tweet with media, falling back to text-only", { error: String(err?.message ?? err) });
    return await postTweet(text, replyToId);
  }
}

/**
 * Attempt to pin a tweet for the authenticating user.
 */
export async function pinTweet(tweetId: string): Promise<boolean> {
  try {
    const clientAny: any = xClient as any;
    if (clientAny.v1 && typeof clientAny.v1.pinTweet === "function") {
      await clientAny.v1.pinTweet(tweetId);
      log("INFO", "Tweet pinned (v1.pinTweet)", { tweetId });
      return true;
    }

    if (clientAny.v1 && typeof clientAny.v1.post === "function") {
      try {
        await clientAny.v1.post("account/pin_tweet", { tweet_id: tweetId });
        log("INFO", "Tweet pinned via account/pin_tweet", { tweetId });
        return true;
      } catch (err) {
        // ignore and try alternative
      }
    }

    log("WARN", "Pin tweet not supported programmatically. Please pin manually if needed.", { tweetId });
    return false;
  } catch (err: any) {
    log("ERROR", "Failed to pin tweet", { tweetId, error: String(err?.message ?? err) });
    return false;
  }
}
