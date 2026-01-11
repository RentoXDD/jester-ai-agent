import fs from "node:fs";
import path from "node:path";

export type RuleType = "hard" | "soft";

export type Rule = {
  id: string;
  enabled: boolean;
  type: RuleType;
  text: string;
  priority: number;
};

export type RulesDoc = {
  version: number;
  updatedAt: string;
  baseSystem: string;
  rules: Rule[];
};

const RULES_PATH = path.join(process.cwd(), "src", "governance", "rules.json");

export function loadRules(): RulesDoc {
  const raw = fs.readFileSync(RULES_PATH, "utf-8");
  return JSON.parse(raw) as RulesDoc;
}

export function getEnabledRulesSorted(doc: RulesDoc): Rule[] {
  return doc.rules
    .filter(r => r.enabled)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function buildSystemPrompt(extra?: string): string {
  const doc = loadRules();
  const rules = getEnabledRulesSorted(doc);

  const hard = rules.filter(r => r.type === "hard");
  const soft = rules.filter(r => r.type === "soft");

  const lines: string[] = [];
  lines.push(doc.baseSystem.trim());
  lines.push("");

  if (hard.length) {
    lines.push("HARD RULES (must follow):");
    for (const r of hard) lines.push(`- ${r.text}`);
    lines.push("");
  }

  if (soft.length) {
    lines.push("STYLE RULES (prefer):");
    for (const r of soft) lines.push(`- ${r.text}`);
    lines.push("");
  }

  if (extra && extra.trim().length) {
    lines.push("EXTRA CONTEXT:");
    lines.push(extra.trim());
    lines.push("");
  }

  return lines.join("\n").trim();
}

/**
 * Allows governance to disable a rule by id.
 */
export function disableRule(ruleId: string): RulesDoc {
  const doc = loadRules();
  const idx = doc.rules.findIndex(r => r.id === ruleId);
  if (idx >= 0) {
    doc.rules[idx].enabled = false;
    doc.updatedAt = new Date().toISOString();
    fs.writeFileSync(RULES_PATH, JSON.stringify(doc, null, 2), "utf-8");
  }
  return doc;
}

/**
 * Allows governance to enable a rule by id.
 */
export function enableRule(ruleId: string): RulesDoc {
  const doc = loadRules();
  const idx = doc.rules.findIndex(r => r.id === ruleId);
  if (idx >= 0) {
    doc.rules[idx].enabled = true;
    doc.updatedAt = new Date().toISOString();
    fs.writeFileSync(RULES_PATH, JSON.stringify(doc, null, 2), "utf-8");
  }
  return doc;
}
