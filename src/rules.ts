import fs from "fs";
import path from "path";
import { CONFIG } from "./config.js";
import { log } from "./logger.js";

export type Rule = {
  id: string;
  title: string;
  enabled: boolean;
  type: "regex" | "suffix" | "prefix";
  value: string;
  severity?: "reject" | "warn";
};

export type RulesFile = {
  version: number;
  character: any;
  constraints: {
    maxTweetChars: number;
    maxReplyChars: number;
  };
  required: Rule[];
  banned: Rule[];
  style: Rule[];
  safety: Rule[];
};

export function loadRules(): RulesFile {
  const fp = path.resolve(CONFIG.paths.rulesFile);
  if (!fs.existsSync(fp)) {
    throw new Error(`Rules file not found: ${fp}`);
  }
  const raw = fs.readFileSync(fp, "utf-8");
  const json = JSON.parse(raw);

  // minimal validation (avoid crash if someone edits badly)
  if (!json.constraints) {
    json.constraints = {
      maxTweetChars: CONFIG.text.maxTweetChars,
      maxReplyChars: CONFIG.text.maxReplyChars,
    };
  }
  for (const k of ["required", "banned", "style", "safety"]) {
    if (!Array.isArray(json[k])) json[k] = [];
  }
  return json as RulesFile;
}

export function saveRules(rules: RulesFile) {
  const fp = path.resolve(CONFIG.paths.rulesFile);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(rules, null, 2), "utf-8");
  log("INFO", "Rules saved", { file: fp });
}

export function disableRuleById(rules: RulesFile, id: string): boolean {
  const all = [...rules.required, ...rules.banned, ...rules.style, ...rules.safety];
  const r = all.find((x) => x.id === id);
  if (!r) return false;
  r.enabled = false;
  return true;
}

export function deleteRuleById(rules: RulesFile, id: string): boolean {
  const keys: (keyof RulesFile)[] = ["required", "banned", "style", "safety"];
  for (const key of keys) {
    const arr = rules[key] as any[];
    const idx = arr.findIndex((x) => x.id === id);
    if (idx >= 0) {
      arr.splice(idx, 1);
      return true;
    }
  }
  return false;
}
