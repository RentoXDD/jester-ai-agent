import "dotenv/config";
import { CONFIG } from "./config.js";
import { log } from "./logger.js";

import { runDailyPost } from "./dailyPost.js";
import { runReplyMentions } from "./replyMentions.js";
import { runCollectMetrics } from "./collectMetrics.js";
import { runPoll } from "./poll.js";

async function main() {
  const mode = process.env.MODE || "daily";

  log("INFO", "Starting Jester", { mode });

  try {
    if (mode === "daily") {
      await runDailyPost();
      return;
    }

    if (mode === "reply") {
      await runReplyMentions();
      return;
    }

    if (mode === "metrics") {
      await runCollectMetrics();
      return;
    }

    if (mode === "poll") {
      await runPoll();
      return;
    }

    log("ERROR", "Unknown MODE", { mode });
    process.exit(1);
  } catch (err: any) {
    log("ERROR", "Fatal error", { error: String(err?.message ?? err) });
    process.exit(1);
  }
}

main();
