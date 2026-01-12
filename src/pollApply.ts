// src/pollApply.ts
// Save/load poll spec and apply winning options.
// applyWinningOption supports ADD_RULE:, REMOVE_RULE:, and CUSTOM:.

import fs from "node:fs";
import path from "node:path";
import { applyGovernanceWinner } from "./rulesEngine.js";
import { log } from "./logger.js";

export type PollOption = {
  id: number; // 1..N
  text: string; // human-readable text
  action?: string; // e.g. "ADD_RULE:...", "REMOVE_RULE:...", or "CUSTOM:..."
  authorId?: string; // optional: who suggested the option (traceability)
};

export type PollSpec = {
  version: number;
  pollId: string;
  createdAt: string;
  // stage1 announcement metadata
  stage1?: {
    tweetId?: string;
    createdAt?: string;
    closesAt?: string;
    status?: "open" | "closed";
  };
  // stage2 final poll metadata
  stage2?: {
    tweetId?: string;
    createdAt?: string;
    closesAt?: string;
    status?: "open" | "closed";
    options?: PollOption[];
  };
  // final result
  final?: {
    decidedAt?: string;
    winner?: {
      optionId: number;
      action?: string;
      details?: any;
    };
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
  } catch (err) {
    log("ERROR", "Failed to load poll spec", { error: String(err ?? "") });
    return null;
  }
}

export function savePollSpec(spec: PollSpec) {
  try {
    ensureDir(POLL_SPEC_FILE);
    fs.writeFileSync(POLL_SPEC_FILE, JSON.stringify(spec, null, 2), "utf-8");
  } catch (err) {
    log("ERROR", "Failed to save poll spec", { error: String(err ?? "") });
    throw err;
  }
}

/**
 * Applies the winning option:
 * - if action starts with ADD_RULE: -> adds a rule via rulesEngine
 * - if action starts with REMOVE_RULE: -> removes/disables a rule via rulesEngine
 * - if action starts with CUSTOM: -> do NOT auto-apply arbitrary text; record selection and return details
 * Returns a result object for logs/memory.
 */
export function applyWinningOption(spec: PollSpec, winnerOptionId: number) {
  const opt = (spec.stage2?.options ?? []).find((o) => o.id === winnerOptionId) ?? null;
  if (!opt) {
    return { ok: false, reason: `Option ${winnerOptionId} not found` };
  }

  const action = (opt.action ?? "").trim();
  if (!action) {
    return { ok: true, action: "NO_ACTION", details: { optionId: winnerOptionId, text: opt.text } };
  }

  // Support CUSTOM: by returning details but not trying to call governance engine.
  if (action.startsWith("CUSTOM:")) {
    const payload = action.substring("CUSTOM:".length);
    return { ok: true, action: "CUSTOM", details: { text: payload } };
  }

  // Known actions
  try {
    const res = applyGovernanceWinner(action);
    return { ok: res.ok, action: res.action ?? "UNKNOWN", details: res.details };
  } catch (err: any) {
    log("ERROR", "applyGovernanceWinner failed", { action, error: String(err?.message ?? err) });
    return { ok: false, action: "ERROR", details: { error: String(err?.message ?? err) } };
  }
}
