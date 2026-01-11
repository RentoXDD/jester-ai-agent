import { xClient } from "./xClient.js";
import { log } from "./logger.js";
export type Mention = { id: string; text: string; author_id?: string };
export async function fetchMentionsSince(sinceId?: string, limit: number = 5): Promise<{ mentions: Mention[]; newestId?: string }> {
  const me = await xClient.v2.me();
  const userId = me.data.id;
  const params: any = { max_results: Math.min(100, Math.max(5, limit)) };
  if (sinceId) params.since_id = sinceId;
  const timeline = await xClient.v2.userMentionTimeline(userId, params);
  const mentions: Mention[] = [];
  let newestId: string | undefined;
  for await (const t of timeline) {
    mentions.push({ id: t.id, text: t.text, author_id: (t as any).author_id });
    newestId = t.id;
    if (mentions.length >= limit) break;
  }
  log("INFO","Fetched mentions",{ count: mentions.length });
  return { mentions, newestId };
}
