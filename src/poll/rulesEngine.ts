import fs from "fs";
import path from "path";
import { PollOption } from "./types.js";

type RulesFile = {
  rules: Array<{ key: string; text: string; enabled: boolean }>;
};

export function loadRulesFile(): RulesFile {
  const p = path.resolve("data/rules.json");
  if (!fs.existsSync(p)) {
    const base: RulesFile = { rules: [] };
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(base, null, 2), "utf-8");
    return base;
  }
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

export function saveRulesFile(data: RulesFile) {
  const p = path.resolve("data/rules.json");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}

export function applyOptionToRules(opt: PollOption) {
  const before = loadRulesFile();
  const after: RulesFile = { rules: [...before.rules] };

  const idx = after.rules.findIndex((r) => r.key === opt.key);

  const patch: any = { action: opt.action, key: opt.key };

  if (opt.action === "add_rule") {
    if (!opt.text) throw new Error("add_rule requires text");
    if (idx === -1) {
      after.rules.push({ key: opt.key, text: opt.text, enabled: true });
      patch.before = null;
      patch.after = { key: opt.key, text: opt.text, enabled: true };
    } else {
      // If the rule already existed — enable it and update text
      patch.before = { ...after.rules[idx] };
      after.rules[idx] = { ...after.rules[idx], text: opt.text, enabled: true };
      patch.after = { ...after.rules[idx] };
    }
  }

  if (opt.action === "remove_rule") {
    if (idx === -1) {
      patch.before = null;
      patch.after = null;
    } else {
      patch.before = { ...after.rules[idx] };
      // Remove entirely
      after.rules.splice(idx, 1);
      patch.after = null;
    }
  }

  if (opt.action === "replace_rule") {
    if (!opt.text) throw new Error("replace_rule requires text");
    if (idx === -1) {
      patch.before = null;
      after.rules.push({ key: opt.key, text: opt.text, enabled: true });
      patch.after = { key: opt.key, text: opt.text, enabled: true };
    } else {
      patch.before = { ...after.rules[idx] };
      after.rules[idx] = { ...after.rules[idx], text: opt.text, enabled: true };
      patch.after = { ...after.rules[idx] };
    }
  }

  saveRulesFile(after);
  return patch;
}
