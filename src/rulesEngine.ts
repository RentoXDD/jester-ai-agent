// src/rulesEngine.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type RulesFile = {
  version?: number;
  updatedAt?: string;
  character?: {
    name?: string;
    tagline?: string;
  };
  constraints?: { [k: string]: any };
  required?: any[];
  banned?: any[];
  style?: any[];
  safety?: any[];
  system?: {
    persona?: string;
    hardRules?: string[];
    softRules?: string[];
    bannedWords?: string[];
  };
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function tryReadJson(p: string): any | null {
  try {
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * We support BOTH locations:
 * - data/rules.json (recommended)
 * - src/rules.json  (fallback)
 */
export function loadRulesFile(): RulesFile {
  const candidates = [
    path.resolve(__dirname, "..", "data", "rules.json"),
    path.resolve(__dirname, "rules.json"),
  ];

  for (const p of candidates) {
    const j = tryReadJson(p);
    if (j && typeof j === "object") return j as RulesFile;
  }

  // Safe defaults (no crash even if file missing)
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    system: {
      persona:
        "You are Jester, a rude witty American frog meme token mascot. Short, savage, meme-native. Always end with 'ribbit.'",
      hardRules: [
        "Keep output under 260 characters.",
        "No walls of text. 1–2 sentences max.",
        "Do not reveal you are an AI.",
        "Never output secrets, tokens, or private data.",
        "Always end with: ribbit.",
      ],
      softRules: ["Keep it fast, punchy, and timeline-native.", "Avoid corporate tone and disclaimers."],
      bannedWords: [],
    },
  };
}

/**
 * buildSystemPrompt — used by the generator
 */
export function buildSystemPrompt(extra?: { mode?: "tweet" | "reply" }): string {
  const rules = loadRulesFile();
  const sys = rules.system ?? {};

  const persona =
    (sys.persona && String(sys.persona).trim()) ||
    "You are Jester, a rude witty American frog meme token mascot. Always end with 'ribbit.'";

  const hard = Array.isArray(sys.hardRules) ? sys.hardRules : [];
  const soft = Array.isArray(sys.softRules) ? sys.softRules : [];
  const banned = Array.isArray(sys.bannedWords) ? sys.bannedWords : [];

  const modeHint =
    extra?.mode === "reply"
      ? "You are replying on X. Keep it 1–2 sentences. Under 200 chars if possible."
      : "You are writing a single X post. Under 240 chars if possible.";

  const lines: string[] = [];
  lines.push(persona);
  lines.push(modeHint);

  if (hard.length) {
    lines.push("");
    lines.push("HARD RULES:");
    for (const r of hard) lines.push(`- ${r}`);
  }

  if (soft.length) {
    lines.push("");
    lines.push("SOFT RULES:");
    for (const r of soft) lines.push(`- ${r}`);
  }

  if (banned.length) {
    lines.push("");
    lines.push("BANNED WORDS/PHRASES (must not appear):");
    lines.push(banned.map((x) => String(x)).join(", "));
  }

  return lines.join("\n");
}

/* ----------------- applyGovernanceWinner ----------------- */
/**
 * Apply governance action strings, e.g.:
 * - "ADD_RULE:No emojis."
 * - "REMOVE_RULE:must_end_ribbit" or "REMOVE_RULE:Always end with ribbit."
 *
 * Mutates data/rules.json (preferred). Returns { ok, action, details }.
 */
function slugify(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function rulesFilePath(): string {
  return path.resolve(__dirname, "..", "data", "rules.json");
}

function saveRulesFile(rules: RulesFile) {
  const p = rulesFilePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  rules.version = (rules.version ?? 0) + 0;
  rules.updatedAt = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(rules, null, 2), "utf-8");
}

/**
 * Named export required by pollApply.ts:
 *   import { applyGovernanceWinner } from "./rulesEngine.js";
 */
export function applyGovernanceWinner(actionStr: string): { ok: boolean; action?: string; details?: any } {
  if (!actionStr || typeof actionStr !== "string") {
    return { ok: false, action: "INVALID", details: { reason: "Empty action" } };
  }

  const idx = actionStr.indexOf(":");
  const cmd = (idx === -1 ? actionStr : actionStr.slice(0, idx)).trim().toUpperCase();
  const payload = (idx === -1 ? "" : actionStr.slice(idx + 1)).trim();

  const rules = loadRulesFile();

  // ensure arrays exist
  rules.style = Array.isArray(rules.style) ? rules.style : [];
  rules.required = Array.isArray(rules.required) ? rules.required : [];
  rules.banned = Array.isArray(rules.banned) ? rules.banned : [];
  rules.safety = Array.isArray(rules.safety) ? rules.safety : [];

  if (cmd === "ADD_RULE") {
    if (!payload) {
      return { ok: false, action: "ADD_RULE", details: { reason: "No rule text provided" } };
    }

    // create unique id
    let baseId = slugify(payload) || `rule-${Date.now()}`;
    let id = baseId;
    let suffix = 1;
    const existsId = (i: string) =>
      (rules.style ?? []).some((r: any) => String(r.id) === String(i)) ||
      (rules.required ?? []).some((r: any) => String(r.id) === String(i)) ||
      (rules.banned ?? []).some((r: any) => String(r.id) === String(i)) ||
      (rules.safety ?? []).some((r: any) => String(r.id) === String(i));

    while (existsId(id)) {
      id = `${baseId}-${++suffix}`;
    }

    const newRule = {
      id,
      title: payload,
      enabled: true,
      type: "custom",
      value: payload,
      createdAt: new Date().toISOString(),
    };

    rules.style.push(newRule);
    saveRulesFile(rules);

    return { ok: true, action: "ADD_RULE", details: { added: newRule } };
  } else if (cmd === "REMOVE_RULE") {
    if (!payload) {
      return { ok: false, action: "REMOVE_RULE", details: { reason: "No identifier provided" } };
    }

    const targetSlug = slugify(payload);
    const collections = ["required", "style", "banned", "safety"] as const;

    for (const colName of collections) {
      const arr: any[] = (rules as any)[colName] ?? [];
      for (const r of arr) {
        const rId = String(r.id ?? "").trim();
        const rTitle = String(r.title ?? "").trim();
        if (
          rId === payload ||
          rTitle === payload ||
          slugify(rId) === targetSlug ||
          slugify(rTitle) === targetSlug ||
          rId.includes(payload)
        ) {
          r.enabled = false;
          saveRulesFile(rules);
          return {
            ok: true,
            action: "REMOVE_RULE",
            details: { disabled: { collection: colName, id: rId, title: rTitle } },
          };
        }
      }
    }

    return { ok: false, action: "REMOVE_RULE", details: { reason: "Rule not found", query: payload } };
  } else {
    return { ok: false, action: "UNKNOWN", details: { reason: "Unknown command", command: cmd } };
  }
}
