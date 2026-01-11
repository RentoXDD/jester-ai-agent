import { loadRules, Rule, RulesFile } from "./rules.js";
import { ensureRibbit, normalizeWhitespace } from "./text.js";
import { CONFIG } from "./config.js";

export function finalizeTweet(text: string): string {
  const t = normalizeWhitespace(text);
  return ensureRibbit(t);
}

export function validateOutput(text: string, kind: "tweet" | "reply" = "tweet"): { ok: true } | { ok: false; reason: string } {
  const rules = loadRules();
  const maxLen = kind === "tweet" ? rules.constraints.maxTweetChars : rules.constraints.maxReplyChars;
  const t = normalizeWhitespace(text);

  if (!t || t.length < 3) return { ok: false, reason: "empty_or_too_short" };
  if (t.length > maxLen) return { ok: false, reason: `too_long_${t.length}_${maxLen}` };

  // must end ribbit (or required rules)
  const required = rules.required.filter((r) => r.enabled);
  for (const r of required) {
    if (r.type === "suffix") {
      const end = r.value.toLowerCase();
      if (!t.toLowerCase().trim().endsWith(end)) {
        return { ok: false, reason: `missing_required_${r.id}` };
      }
    }
  }

  // banned/style/safety checks
  const allReject = [
    ...rules.banned.filter((r) => r.enabled),
    ...rules.style.filter((r) => r.enabled),
    ...rules.safety.filter((r) => r.enabled),
  ];

  for (const rule of allReject) {
    if (rule.type === "regex") {
      const re = new RegExp(rule.value, "i");
      if (re.test(t)) {
        return { ok: false, reason: `rule_reject_${rule.id}` };
      }
    }
    if (rule.type === "prefix") {
      if (t.toLowerCase().startsWith(rule.value.toLowerCase())) {
        return { ok: false, reason: `rule_reject_${rule.id}` };
      }
    }
    if (rule.type === "suffix") {
      if (t.toLowerCase().endsWith(rule.value.toLowerCase())) {
        // suffix rule in banned list
        return { ok: false, reason: `rule_reject_${rule.id}` };
      }
    }
  }

  return { ok: true };
}

/**
 * Builds the system prompt from rules.json
 * So the model naturally follows rules instead of only post-validation.
 */
export function buildSystemPrompt(kind: "tweet" | "reply"): string {
  const rules = loadRules();

  const maxLen = kind === "tweet" ? rules.constraints.maxTweetChars : rules.constraints.maxReplyChars;
  const required = rules.required.filter((r) => r.enabled).map((r) => `- REQUIRED: ${r.title}`);
  const banned = [...rules.banned, ...rules.style, ...rules.safety]
    .filter((r) => r.enabled)
    .map((r) => `- NEVER: ${r.title}`);

  const style = [
    `You are ${rules.character?.name ?? "Jester"}, a rude witty American frog meme token mascot.`,
    `Write in short sentences, meme-native.`,
    `No corporate tone, no assistant behavior.`,
    `Max length: ${maxLen} chars.`,
    `ALWAYS end with "ribbit."`,
  ];

  return [...style, "", ...required, "", ...banned].join("\n");
}
