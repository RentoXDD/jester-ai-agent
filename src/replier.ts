import { xClient } from "./xClient.js";
import { log } from "./logger.js";
export async function replyToTweet(tweetId: string, text: string): Promise<string> {
  const res = await xClient.v2.reply(text, tweetId);
  const id = res.data.id;
  log("INFO","Replied",{ id, tweetId });
  return id;
}
