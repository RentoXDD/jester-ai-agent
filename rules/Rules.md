# 📜 Rules & Governance for Jester AI Agent

<table width="100%"><tr><td align="left">
🌐 Languages: English 🇺🇸</a> | <a href="/rules/rules.zh.md">中文 🇨🇳</a>
</td></tr><tr><td align="right">  &nbsp; • &nbsp;
<a href="../README.md">📘Main page</a> &nbsp; • &nbsp;
<a href="./rules/CURRENT_RULES.md">✅ Current Rules</a>
</td></tr></table>

---

**🕒 Last updated:** 2026-01-12T00:00:00Z

This document is the authoritative, human-readable description of the governance system used by the Jester AI Agent: how rule proposals are collected, how votes are held, how final decisions are recorded, and the canonical change log for rules.

> The runtime state is also stored in `data/poll.json` and rules may be stored in `data/rules.json`. This document supplements those files with explanations and a human-readable changelog.


## 📚 Table of contents

- [📋 Current Rules ](/rules/CURRENT_RULES.md)  
- [🏛 Governance Overview](#-governance-overview)  
- [🗳 Two-stage Weekly Poll (Flow)](#-two-stage-weekly-poll-flow)  
- [📝 Change Log](#-change-log)  
- [💡 How to Propose Changes](#-how-to-propose-changes)  
- [🔢 How Votes Are Counted](#-how-votes-are-counted)  
- [📌 Pinning & Permissions](#-pinning--permissions)  
- [🧪 Testing / Debugging Tips](#-testing--debugging-tips)  

---

## 🏛 Governance Overview

- **Weekly, two-stage poll**:
  1. **Stage 1 — Announcement & Suggestions.** Jester posts a short announcement and pins it. Community replies with suggestions. 📣  
  2. **Stage 2 — Final Vote.** After 24 hours, the system selects the top suggestions (by likes, deduped by author) and posts a final vote. After another 24 hours the winner is declared and pinned. 🕘➡️🕘
- **Selection policy:** Stage 1 selects suggestions by `public_metrics.like_count`. Deduplication ensures one selected suggestion per author in the top list. 👍
- **Final voting:** Stage 2 accepts numeric replies (1..N); only the first valid reply per user counts. 🧾
- **Safety:** `CUSTOM:` proposals are recorded but **not** auto-applied by default. Only `ADD_RULE:` and `REMOVE_RULE:` are applied automatically if the rules engine supports it. 🔒

---

## 🗳 Two-stage Weekly Poll (Flow)

1. **Stage 1 — Post Announcement** 📣  
   - Jester posts an announcement and pins it. The announcement invites community suggestions for rule changes.  
   - The announcement is pinned for the stage duration.

2. **Collect Replies (24h)** ⏳  
   - The system collects replies (conversation replies). It ranks replies by `like_count`, deduplicates by author, and selects the top **N** (default 5) suggestions.  
   - If there are zero suggestions, Stage 1 closes without advancing and logs an admin note. ⚠️

3. **Stage 2 — Post Final Vote** 🗳️  
   - The system posts the final vote with the selected suggestions (numbered `1..N`) and pins that post.  
   - Stage 2 remains open for 24 hours.

4. **Collect Votes (24h)** ✔️  
   - The system collects replies to the Stage 2 tweet, parses numeric votes (dynamic regex for valid option IDs), and accepts the first valid reply per author.  
   - The winner is the option with most votes; tiebreaker is the lower option id.

5. **Final Announcement** 🏁  
   - The final result is posted (and pinned if possible), saved in `data/poll.json`, and a Change Log entry is appended in this README.

## 📝 Change Log

Every completed governance cycle appends a Change Log entry.

### Each entry includes

- Finalization timestamp  
- Winning option  
- Applied action (if any)  
- Reference to poll data  

### Purpose of the Change Log

- Preserve historical context  
- Enable full behavioral reconstruction  
- Support independent audits  

---

## 💡 How to Propose Changes

Rule proposals are submitted during **Stage 1** of the weekly poll.

### How to submit

- Reply directly to the announcement post  

---

 ## 🔢 How Votes Are Counted

Vote counting is strict and deterministic.

### Counting Logic

- Only numeric replies matching valid options are accepted  
- Only the **first valid reply per author** is counted  
- Replies outside the voting window are ignored  
- Results are fully reproducible from raw reply data  

### Interpretation Policy

- No manual interpretation is applied  
- No discretionary adjustments are allowed  

---

## 📌 Pinning & Permissions

### Pinning Behavior

- Stage 1 and Stage 2 posts are pinned when possible  
- Pinning is used for **visibility only**  

### Clarifications

- Pin state does **not** affect vote validity  
- Failure to pin does **not** invalidate governance  
- Correctness never depends on UI behavior  

---


## 🧪 Testing / Debugging Tips

Guidelines for local testing and verification.

### Recommended Checks

- Inspect `data/poll.json` after execution  
- Validate diffs in `data/rules.json`  
- Use dry-run modes when available  

