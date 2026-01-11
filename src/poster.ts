import { xClient } from "./xClient.js";
import { log } from "./logger.js";
export async function postTweet(text: string): Promise<string> {
  const res = await xClient.v2.tweet(text);
  const id = res.data.id;
  log("INFO","Tweet posted",{ id });
  return id;
}
