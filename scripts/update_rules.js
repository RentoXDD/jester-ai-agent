#!/usr/bin/env node
// scripts/update_rules.js
//
// Usage: run inside repo root (GitHub Actions): node scripts/update_rules.js
//
// This script:
// - reads data/poll.json and rules/README.md and data/rules.json
// - if final winner exists and corresponds to ADD_RULE / REMOVE_RULE / CUSTOM,
//   updates data/rules.json accordingly and appends a row to rules/README.md Change Log
// - commits and pushes changes using git (assumes GITHUB_TOKEN and checkout with write access)

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

function safeReadJSON(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    console.error('Failed to read/parse JSON', p, err);
    return fallback;
  }
}

function writeJSON(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function appendChangeLogEntry(readmePath, row) {
  let md = '';
  try {
    md = fs.readFileSync(readmePath, 'utf8');
  } catch (err) {
    console.error('rules README not found at', readmePath);
    // create a minimal file with change log if missing
    md = [
      '# Rules & Governance for Jester AI Agent',
      '',
      '## 📝 Change Log',
      '',
      '| Date (UTC) | Poll ID / Source | Change | By | Notes |',
      '|---|---:|---|---|---|',
      '',
      '',
      '',
      '## 💡 How to Propose Changes',
      '',
    ].join('\n');
  }

  const insertBefore = '## 💡 How to Propose Changes';
  const idx = md.indexOf(insertBefore);
  if (idx === -1) {
    // fallback: append at end
    md = md.trim() + '\n\n' + row + '\n';
  } else {
    const before = md.slice(0, idx);
    const after = md.slice(idx);
    // ensure there's exactly one newline before row
    let newBefore = before.trimEnd() + '\n' + row + '\n\n';
    md = newBefore + after;
  }

  fs.writeFileSync(readmePath, md, 'utf8');
  console.log('Appended changelog row to', readmePath);
}

function git(cmd) {
  console.log('> git', cmd);
  return cp.execSync('git ' + cmd, { stdio: 'inherit' });
}

async function main() {
  const repoRoot = process.cwd();
  const pollPath = path.resolve(repoRoot, 'data', 'poll.json');
  const rulesPath = path.resolve(repoRoot, 'data', 'rules.json');
  const rulesReadme = path.resolve(repoRoot, 'rules', 'README.md');

  if (!fs.existsSync(pollPath)) {
    console.log('No data/poll.json found. Nothing to do.');
    return;
  }

  const spec = safeReadJSON(pollPath, null);
  if (!spec || !spec.final || !spec.final.winner) {
    console.log('No final winner in poll spec. Nothing to do.');
    return;
  }

  const winner = spec.final.winner;
  if (!winner || winner.optionId === -1) {
    console.log('Final winner indicates NO_CHANGE or missing. Nothing to do.');
    return;
  }

  // find the option in stage2
  const options = (spec.stage2 && spec.stage2.options) || [];
  const opt = options.find(o => Number(o.id) === Number(winner.optionId));
  if (!opt) {
    console.error('Winner option not found in stage2 options. Aborting.');
    return;
  }

  const action = (opt.action || winner.action || '').trim();
  const pollId = spec.pollId || '(unknown)';

  // load or create rules.json
  const rulesObj = safeReadJSON(rulesPath, { rules: [] });

  const timestamp = new Date().toISOString();
  let changeType = '';
  let ruleId = '';
  let ruleText = '';
  let note = '';

  if (action.startsWith('ADD_RULE:')) {
    changeType = 'Added';
    ruleText = action.substring('ADD_RULE:'.length).trim() || opt.text;
    ruleId = slugify(ruleText).slice(0, 50) || 'auto-' + Date.now();
    // ensure unique id
    const exists = (rulesObj.rules || []).find(r => r.id === ruleId);
    if (exists) ruleId = ruleId + '-' + Date.now();
    const newRule = {
      id: ruleId,
      text: ruleText,
      enabled: true,
      addedAt: timestamp,
      source: `poll:${pollId}`,
      notes: `Auto-applied from final winner`
    };
    rulesObj.rules.push(newRule);
    note = `Final winner: \`${action}\``;
    console.log('Adding rule:', newRule.id);
  } else if (action.startsWith('REMOVE_RULE:')) {
    changeType = 'Removed';
    ruleText = action.substring('REMOVE_RULE:'.length).trim();
    // try to find by id, else by text
    let found = (rulesObj.rules || []).find(r => r.id === ruleText || r.text === ruleText);
    if (!found) {
      // also try slug match
      const slug = slugify(ruleText);
      found = (rulesObj.rules || []).find(r => r.id === slug);
    }
    if (found) {
      found.enabled = false;
      found.notes = (found.notes || '') + `\nDisabled by poll:${pollId} at ${timestamp}`;
      note = `Disabled rule ${found.id}`;
      ruleId = found.id;
      ruleText = found.text;
      console.log('Disabled rule:', found.id);
    } else {
      // If not found, still append a "removal record" as note
      note = `Attempted to remove unknown rule: \`${ruleText}\``;
      console.warn('Could not find rule to remove:', ruleText);
    }
  } else if (action.startsWith('CUSTOM:')) {
    changeType = 'Added (CUSTOM)';
    ruleText = action.substring('CUSTOM:'.length).trim() || opt.text;
    ruleId = slugify(ruleText).slice(0, 50) || 'auto-' + Date.now();
    // ensure unique id
    const exists = (rulesObj.rules || []).find(r => r.id === ruleId);
    if (exists) ruleId = ruleId + '-' + Date.now();
    const newRule = {
      id: ruleId,
      text: ruleText,
      enabled: true,
      addedAt: timestamp,
      source: `poll:${pollId}`,
      notes: `Auto-applied from CUSTOM final winner (review recommended)`
    };
    rulesObj.rules.push(newRule);
    note = `Final winner: \`${action}\``;
    console.log('Adding rule from CUSTOM:', newRule.id);
  } else {
    // fallback: treat as ADD with text opt.text
    changeType = 'Added';
    ruleText = opt.text || action || 'Unnamed rule';
    ruleId = slugify(ruleText).slice(0, 50) || 'auto-' + Date.now();
    const exists = (rulesObj.rules || []).find(r => r.id === ruleId);
    if (exists) ruleId = ruleId + '-' + Date.now();
    const newRule = {
      id: ruleId,
      text: ruleText,
      enabled: true,
      addedAt: timestamp,
      source: `poll:${pollId}`,
      notes: `Auto-applied from final winner (fallback)`
    };
    rulesObj.rules.push(newRule);
    note = `Final winner: \`${action || opt.text}\``;
    console.log('Adding fallback rule:', newRule.id);
  }

  // write rules.json
  try {
    writeJSON(rulesPath, rulesObj);
    console.log('Updated rules.json');
  } catch (err) {
    console.error('Failed to write rules.json', err);
    process.exit(1);
  }

  // update rules/README.md change log by inserting a table row before the "How to Propose Changes" header
  const now = new Date().toISOString();
  const changeRow = `| ${now} | poll:${pollId} | ${changeType} \`${(ruleText || '').replace(/\|/g, '\\|')}\` | automation | ${note} |`;

  try {
    appendChangeLogEntry(rulesReadme, changeRow);
  } catch (err) {
    console.error('Failed to update rules README', err);
  }

  // commit and push changes
  try {
    // configure git user
    git('config user.email "actions@github.com"');
    git('config user.name "github-actions[bot]"');

    // add files
    git(`add "${path.relative(repoRoot, rulesPath)}" "${path.relative(repoRoot, rulesReadme)}"`);

    // check if there is anything to commit
    // if no changes, exit
    try {
      cp.execSync('git diff --staged --quiet');
      // nothing to commit?
      console.log('No staged changes to commit.');
      return;
    } catch (err) {
      // there are staged changes
    }

    const commitMsg = `Auto-update rules from poll:${pollId} - ${changeType} ${ruleId}`;
    git(`commit -m "${commitMsg}"`);

    // push: assumes actions/checkout used default token (GITHUB_TOKEN) with write permissions
    git('push');

    console.log('Committed and pushed rule change.');
  } catch (err) {
    console.error('Git commit/push failed', err);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unhandled error in update_rules.js', err);
  process.exit(1);
});
