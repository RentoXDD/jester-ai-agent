// src/index.ts
// Entry point for Jester. Ensure a poll spec exists when running in poll mode,
// so runPoll() won't fail with "No poll.json found to close."

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { CONFIG } from "./config.js";
import { log } from "./logger.js";

import { runDailyPost } from "./dailyPost.js";
import { runReplyMentions } from "./replyMentions.js";
import { runCollectMetrics } from "./collectMetrics.js";
import { runPoll } from "./poll.js";

/**
 * Create a safe default poll spec if it does not exist. This prevents runtime
 * errors when the code expects data/poll.json to be present.
 */
function ensureDefaultPollJson() {
  try {
    const pollPath = path.resolve("data", "poll.json");
    if (!fs.existsSync(pollPath)) {
      fs.mkdirSync(path.dirname(pollPath), { recursive: true });
      const now = new Date().toISOString();
      const closesAt = new Date(Date.now() + 24 * 3600_000).toISOString(); // +24h
      const spec = {
        version: 1,
        pollId: String(Date.now()),
        createdAt: now,
        closesAt,
        status: "open",
        options: [
          { id: 1, text: "Add rule: no emojis", action: "ADD_RULE:No emojis." },
          { id: 2, text: "Add rule: no hashtags unless needed", action: "ADD_RULE:No hashtags unless absolutely needed." },
          { id: 3, text: "Remove rule: format-short", action: "REMOVE_RULE:format-short" },
          { id: 4, text: "Remove rule: end-ribbit", action: "REMOVE_RULE:end-ribbit" },
          { id: 5, text: "Add rule: replies more aggressive", action: "ADD_RULE:Replies should be more aggressive and punchy." },
        ],
        // set tweetId to null so poll close won't try to talk to Twitter if we don't want it
        tweetId: null
      };
      fs.writeFileSync(pollPath, JSON.stringify(spec, null, 2), "utf8");
      log("INFO", `Created default poll spec at ${pollPath}`);
    } else {
      // validate JSON is parseable; if not, back it up and write a safe default
      const raw = fs.readFileSync(pollPath, "utf8");
      try {
        JSON.parse(raw);
      } catch (err) {
        const backup = `${pollPath}.invalid.${Date.now()}`;
        fs.renameSync(pollPath, backup);
        log("WARN", `Invalid JSON in ${pollPath}; backed up to ${backup}`);
        ensureDefaultPollJson(); // write default now
      }
    }
  } catch (err) {
    log("ERROR", "Failed to ensure default poll.json", { error: String(err) });
    // don't throw — runPoll() is already defensive, so we prefer graceful continue
  }
}

async function main() {
  const mode = process.env.MODE || "daily";

  log("INFO", "Starting Jester", { mode });

  try {
    if (mode === "poll") {
      // Ensure poll.json exists before running poll logic
      ensureDefaultPollJson();
      await runPoll();
      return;
    }

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

    log("ERROR", "Unknown MODE", { mode });
    process.exit(1);
  } catch (err: any) {
    log("ERROR", "Fatal error", { error: String(err?.message ?? err) });
    process.exit(1);
  }
}

main();
