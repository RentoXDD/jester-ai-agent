// src/config.ts
import "dotenv/config";
import { join } from "node:path";

export type Mode = "daily" | "reply" | "metrics" | "poll" | "agent_fix";

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, "data");

// ✅ Single source of truth for paths
export const PATHS = {
  ROOT,
  DATA_DIR,

  // UPPERCASE keys are the primary style
  MEMORY_FILE: join(DATA_DIR, "memory.json"),
  RULES_FILE: join(DATA_DIR, "rules.json"),
  POLL_SPEC_FILE: join(DATA_DIR, "pollSpec.json"),
  GOVERNANCE_DIR: join(DATA_DIR, "governance"),

  // lowercase keys are backward-compat aliases (in case they were used somewhere)
  dataDir: join(DATA_DIR, ""),
  memoryFile: join(DATA_DIR, "memory.json"),
  rulesFile: join(DATA_DIR, "rules.json"),
  pollSpecFile: join(DATA_DIR, "pollSpec.json"),
  governanceDir: join(DATA_DIR, "governance"),
};

// helpers
function env(name: string, fallback?: string) {
  const v = process.env[name];
  if (v === undefined || v === null || v === "") return fallback;
  return v;
}

function envInt(name: string, fallback: number) {
  const v = env(name);
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

// ✅ Central config (imported everywhere)
export const CONFIG = {
  mode: env("MODE", "daily") as Mode,

  llm: {
    provider: env("LLM_PROVIDER", "groq") as "groq" | "openai",
    baseURL: env("LLM_BASE_URL", "https://api.groq.com/openai/v1")!,
    apiKey: env("GROQ_API_KEY") || env("LLM_API_KEY") || "",
    model: env("GROQ_MODEL", "llama-3.1-8b-instant")!,
    temperature: Number(env("LLM_TEMPERATURE", "1.0")),
  },

  x: {
    appKey: env("X_APP_KEY", "")!,
    appSecret: env("X_APP_SECRET", "")!,
    accessToken: env("X_ACCESS_TOKEN", "")!,
    accessSecret: env("X_ACCESS_SECRET", "")!,
  },

  paths: {
    memoryFile: env("MEMORY_FILE", PATHS.MEMORY_FILE)!,
    rulesFile: env("RULES_FILE", PATHS.RULES_FILE)!,
    pollSpecFile: env("POLL_SPEC_FILE", PATHS.POLL_SPEC_FILE)!,
    governanceDir: env("GOVERNANCE_DIR", PATHS.GOVERNANCE_DIR)!,
  },

  rules: {
    // this field used to be undefined in one of the cases
    rulesFile: env("RULES_FILE", PATHS.RULES_FILE)!,

    // future: if you want to add rule limits/modes
    maxRules: envInt("RULES_MAX", 200),
  },

  poll: {
    // voting window (currently 24 hours)
    windowHours: envInt("POLL_WINDOW_HOURS", 24),

    // options 1..5
    minOption: envInt("POLL_MIN_OPTION", 1),
    maxOption: envInt("POLL_MAX_OPTION", 5),
  },

  // Max replies per run (workflow passes MAX_REPLIES_PER_RUN)
  MAX_REPLIES_PER_RUN: envInt("MAX_REPLIES_PER_RUN", 8),
};
