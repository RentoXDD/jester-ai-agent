// src/poster.ts
/**
 * Poster helpers — post text and post text+media to X (Twitter).
 *
 * Requirements:
 *  - xClient export from src/xClient.js (twitter-api-v2 client configured)
 *  - logger export from src/logger.js
 *
 * Behavior:
 *  - postTweet(text, replyToId?)                 -> posts text-only tweet
 *  - postTweetWithMedia(text, imageBuffer?, ...) -> attempts to upload media and post tweet with media_ids,
 *                                                  falls back to text-only if upload fails
 *  - pinTweet(tweetId)                           -> attempts to pin tweet for authenticated user
 */

import { xClient } from "./xClient.js";
import { log } from "./logger.js";

type TweetResponseV2 = { data?: { id: string } };

// ✅ IMPORTANT: must be exported because src/poll.ts imports it as a named export
export async function postTweet(text: string, replyToId?: string): Promise<string> {
  try {
    let res: TweetResponseV2;
    if (replyToId) {
      res = (await xClient.v2.tweet({
        text,
        reply: { in_reply_to_tweet_id: replyToId },
      })) as TweetResponseV2;
    } else {
      res = (await xClient.v2.tweet({ text })) as TweetResponseV2;
    }

    const id = res?.data?.id;
    if (!id) throw new Error("No tweet id returned");
    log("INFO", "Tweet posted (text-only)", { id, length: text.length });
    return id;
  } catch (err: any) {
    log("ERROR", "Failed to post text tweet", { error: String(err?.message ?? err) });
    throw err;
  }
}

/**
 * Upload image Buffer and return media_id string (or throw).
 * Tries client.v1.uploadMedia() -> client.v1.post("media/upload") fallback.
 */
async function uploadImageBuffer(buffer: Buffer): Promise<string> {
  const clientAny: any = xClient as any;

  // Preferred: twitter-api-v2 v1.uploadMedia convenience
  try {
    if (clientAny.v1 && typeof clientAny.v1.uploadMedia === "function") {
      // uploadMedia may accept Buffer
      const mediaId = await clientAny.v1.uploadMedia(buffer, { mimeType: "image/png" });
      if (mediaId) {
        log("INFO", "Media uploaded via v1.uploadMedia", { mediaId });
        return mediaId;
      }
    }
  } catch (err) {
    log("WARN", "v1.uploadMedia failed, will try fallback", {
      error: String((err as any)?.message ?? err),
    });
    // fallthrough to next method
  }

  // Fallback: v1.post("media/upload") with base64
  try {
    if (clientAny.v1 && typeof clientAny.v1.post === "function") {
      const b64 = buffer.toString("base64");
      // v1.post may accept endpoint 'media/upload' for legacy API
      const res = await clientAny.v1.post("media/upload", { media: b64 });
      const mediaId = res?.media_id_string || res?.media_id;
      if (mediaId) {
        log("INFO", "Media uploaded via v1.post media/upload", { mediaId });
        return mediaId;
      }
    }
  } catch (err) {
    log("WARN", "v1.post('media/upload') failed", {
      error: String((err as any)?.message ?? err),
    });
  }

  // If we reach here, upload failed
  throw new Error("Media upload not supported or upload failed.");
}

/**
 * Post tweet with optional image.
 * If imageBuffer is provided, tries to upload and include as media. If upload fails, falls back to text-only.
 *
 * Returns tweetId string.
 */
export async function postTweetWithMedia(
  text: string,
  imageBuffer?: Buffer,
  replyToId?: string
): Promise<string> {
  try {
    if (!imageBuffer) {
      return await postTweet(text, replyToId);
    }

    // upload media
    let mediaId: string | null = null;
    try {
      mediaId = await uploadImageBuffer(imageBuffer);
    } catch (upErr: any) {
      log("ERROR", "Media upload failed, falling back to text-only", {
        error: String(upErr?.message ?? upErr),
      });
      // fallback to text-only
      return await postTweet(text, replyToId);
    }

    // post tweet with media
    try {
      const res = await xClient.v2.tweet({
        text,
        media: { media_ids: [mediaId] },
        reply: replyToId ? { in_reply_to_tweet_id: replyToId } : undefined,
      });
      const id = (res as TweetResponseV2)?.data?.id;
      if (!id) throw new Error("No tweet id returned after posting with media");
      log("INFO", "Tweet with media posted", { id, mediaId });
      return id;
    } catch (err) {
      log("ERROR", "Failed to post tweet with media, trying text-only fallback", {
        error: String((err as any)?.message ?? err),
      });
      // fallback: post text-only
      return await postTweet(text, replyToId);
    }
  } catch (err: any) {
    log("ERROR", "Unexpected error in postTweetWithMedia, falling back to text-only", {
      error: String(err?.message ?? err),
    });
    // ultimate fallback: throw or attempt text-only
    return await postTweet(text, replyToId);
  }
}

/**
 * Attempt to pin a tweet for the authenticating user.
 * Returns true if succeeded, false if not supported or failed.
 */
export async function pinTweet(tweetId: string): Promise<boolean> {
  const clientAny: any = xClient as any;

  try {
    // twitter-api-v2 helper
    if (clientAny.v1 && typeof clientAny.v1.pinTweet === "function") {
      await clientAny.v1.pinTweet(tweetId);
      log("INFO", "Pinned tweet via v1.pinTweet", { tweetId });
      return true;
    }

    // legacy POST endpoint
    if (clientAny.v1 && typeof clientAny.v1.post === "function") {
      try {
        await clientAny.v1.post("account/pin_tweet", { tweet_id: tweetId });
        log("INFO", "Pinned tweet via account/pin_tweet", { tweetId });
        return true;
      } catch (err) {
        // continue to general fallback
        log("WARN", "account/pin_tweet failed", {
          error: String((err as any)?.message ?? err),
        });
      }
    }

    log("WARN", "Pin tweet not supported by client", { tweetId });
    return false;
  } catch (err: any) {
    log("ERROR", "Failed to pin tweet", { tweetId, error: String(err?.message ?? err) });
    return false;
  }
}
