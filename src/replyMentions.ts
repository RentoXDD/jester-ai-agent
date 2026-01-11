import { MemoryStore } from "./memoryStore.js";
import { fetchMentionsSince } from "./mentions.js";
import { generateReply } from "./generator.js";
import { validateOutput, finalizeTweet } from "./guardrails.js";
import { replyToTweet } from "./replier.js";
import { log } from "./logger.js";
import { normalizeWhitespace } from "./text.js";
import { CONFIG } from "./config.js";
export async function runReplyMentions(){
  const store=new MemoryStore();
  const sinceId=store.getState("last_mention_id") || undefined;
  const { mentions, newestId } = await fetchMentionsSince(sinceId, CONFIG.MAX_REPLIES_PER_RUN);
  if(mentions.length===0){ log("INFO","No new mentions"); return; }
  const lastPost=store.getLastPost()?.content || "No posts yet.";
  const successPatterns=store.getPatterns("success",10);
  const failPatterns=store.getPatterns("avoid",10);
  let replied=0;
  for(const m of mentions){
    if(replied>=CONFIG.MAX_REPLIES_PER_RUN) break;
    const raw=await generateReply({ userText:m.text, lastPost, successPatterns, failPatterns });
    const reply=finalizeTweet(normalizeWhitespace(raw));
    const check=validateOutput(reply);
    if(!check.ok){ log("WARN","Reply rejected",{ mention_id:m.id, reason: check.reason, reply }); continue; }
    await replyToTweet(m.id, reply);
    replied++;
  }
  if(newestId) store.setState("last_mention_id", newestId);
  log("INFO","Reply job finished",{ replied });
}
