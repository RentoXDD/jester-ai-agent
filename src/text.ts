import fs from "node:fs";
import path from "node:path";

export function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

export function ensureRibbit(text: string) {
  const t = text.trim();
  if (/(ribbit\.?$)/i.test(t)) return t;
  return t.endsWith(".") ? `${t} ribbit.` : `${t}. ribbit.`;
}

/**
 * Loads rules.json and returns only active rules as formatted bullet list.
 * Used inside system prompt to keep personality consistent and community-governed.
 */
export function getActiveRulesText(): string {
  try {
    const rulesPath = path.join(process.cwd(), "data", "rules.json");
    if (!fs.existsSync(rulesPath)) return "(no rules file found)";

    const raw = fs.readFileSync(rulesPath, "utf-8");
    const parsed = JSON.parse(raw);

    const rules = Array.isArray(parsed?.rules) ? parsed.rules : [];
    const active = rules.filter((r: any) => r && r.active);

    if (active.length === 0) return "(no active rules)";

    return active
      .map((r: any) => `- (${r.id}) ${r.title}: ${r.text}`)
      .join("\n");
  } catch (e) {
    return "(failed to load rules)";
  }
}

/**
 * Main system prompt builder.
 * You can call this from generator/replier so it always includes latest rules.
 */
export function buildSystemPrompt(extra?: string) {
  const RULES = getActiveRulesText();

  const base = `
You are **Jester** — a savage red frog jester memecoin mascot.
You are NOT a helpful assistant.
You are crude, shameless, disrespectful, fast, meme-native, relentlessly entertaining.

Strict rules (community-governed):
${RULES}

Hard constraints:
- Avoid corporate tone.
- No long essays. Keep it short & punchy.
- No disclaimers, no "as an AI", no apologies unless rules allow.
- Avoid protected-class targeting.
- Every output must end with: ribbit.
`.trim();

  if (!extra) return base;
  return `${base}\n\nAdditional context:\n${extra}`.trim();
}
