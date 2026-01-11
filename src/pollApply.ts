// src/pollApply.ts
import fs from "node:fs";
import path from "node:path";
import { PATHS } from "./config.js";
import { applyGovernanceWinner } from "./rulesEngine.js";
import { log } from "./logger.js";

export type PollOption = {
  id: number; // 1..5
  text: string; // human-readable text
  action?: string; // e.g. "ADD_RULE:..." or "REMOVE_RULE:..."
};

export type PollSpec = {
  version: number;
  pollId: string; // identifier (timestamp or uuid)
  tweetId?: string; // poll tweet id
  createdAt: string; // ISO
  closesAt: string; // ISO (+24h)
  options: PollOption[]; // 1..5
  status: "open" | "closed";
  winner?: {
    optionId: number;
    action?: string;
    decidedAt: string;
    details?: any;
  };
};

function ensureDir(p: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

const POLL_SPEC_FILE = path.resolve("data", "poll.json");

export function loadPollSpec(): PollSpec | null {
  try {
    if (!fs.existsSync(POLL_SPEC_FILE)) return null;
    const raw = fs.readFileSync(POLL_SPEC_FILE, "utf-8");
    return JSON.parse(raw) as PollSpec;
  } catch {
    return null;
  }
}

export function savePollSpec(spec: PollSpec) {
  ensureDir(POLL_SPEC_FILE);
  fs.writeFileSync(POLL_SPEC_FILE, JSON.stringify(spec, null, 2), "utf-8");
}

/**
 * Applies the winning option:
 * - if action starts with ADD_RULE: -> adds a rule
 * - if action starts with REMOVE_RULE: -> disables a rule (enabled=false)
 * Returns a result object for logs/memory.
 */
export function applyWinningOption(spec: PollSpec, winnerOptionId: number) {
  const opt = spec.options.find((o) => o.id === winnerOptionId);
  if (!opt) {
    return { ok: false, reason: `Option ${winnerOptionId} not found` };
  }

  const action = (opt.action ?? "").trim();
  if (!action) {
    // No action — just record winner without changes
    return { ok: true, action: "NO_ACTION", details: { optionId: winnerOptionId, text: opt.text } };
  }

  const res = applyGovernanceWinner(action);
  return { ok: res.ok, action: res.action ?? "UNKNOWN", details: res.details };
}

/**
 * Closes the poll: records the winner and applies the action.
 */
export function closeAndApply(spec: PollSpec, winnerOptionId: number) {
  const now = new Date().toISOString();
  const applied = applyWinningOption(spec, winnerOptionId);

  spec.status = "closed";
  spec.winner = {
    optionId: winnerOptionId,
    action: spec.options.find((o) => o.id === winnerOptionId)?.action,
    decidedAt: now,
    details: applied,
  };

  savePollSpec(spec);

  log("INFO", "Poll closed & applied", {
    pollId: spec.pollId,
    winnerOptionId,
    applied,
  });

  return applied;
}
