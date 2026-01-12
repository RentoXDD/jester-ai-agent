# 📜 Rules & Governance for Jester AI Agent

**🕒 Last updated:** 2026-01-12T00:00:00Z

This document is the authoritative, human-readable description of the governance system used by the Jester AI Agent: how rule proposals are collected, how votes are held, how final decisions are recorded, and the canonical change log for rules.

> The runtime state is also stored in `data/poll.json` and rules may be stored in `data/rules.json`. This document supplements those files with explanations and a human-readable changelog.

---

## 📚 Table of contents

- [📋 Current Rules ](/rules/CURRENT_RULES.md)  
- [🏛 Governance Overview](#-governance-overview)  
- [🗳 Two-stage Weekly Poll (Flow)](#-two-stage-weekly-poll-flow)  
- [📐 Rule Schema](#-rule-schema)  
- [✅ Current Active Rules (authoritative)](#-current-active-rules-authoritative)  
- [📝 Change Log](#-change-log)  
- [💡 How to Propose Changes](#-how-to-propose-changes)  
- [🔢 How Votes Are Counted](#-how-votes-are-counted)  
- [📌 Pinning & Permissions](#-pinning--permissions)  
- [⚙️ Applying Rules & Automation](#-applying-rules--automation)  
- [🧪 Testing / Debugging Tips](#-testing--debugging-tips)  
- [🔧 Appendix: Examples & Scripts](#-appendix-examples--scripts)

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

---

## 📐 Rule Schema

Rules are stored in JSON. Example `data/rules.json`:

```json
{
  "rules": [
    {
      "id": "format-short",
      "text": "Prefer short posts and short sentences.",
      "enabled": true,
      "addedAt": "2025-10-01T12:00:00Z",
      "source": "manual",
      "notes": "Initial rule"
    }
  ]
}
