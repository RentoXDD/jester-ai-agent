# 📜 Rules & Governance for Jester AI Agent

**🕒 Last updated:** 2026-01-12T00:00:00Z

This document is the authoritative, human-readable description of the governance system used by the Jester AI Agent: how rule proposals are collected, how votes are held, how final decisions are recorded, and the canonical change log for rules.

> The runtime state is also stored in `data/poll.json` and rules may be stored in `data/rules.json`. This document supplements those files with explanations and the narrative changelog for humans.

---

## 📚 Table of contents

- [🏛️ Governance Overview](#-governance-overview)  
- [🗳️ Two-stage Weekly Poll (Flow)](#-two-stage-weekly-poll-flow)  
- [📐 Rule Schema](#-rule-schema)  
- [✅ Current Active Rules](#-current-active-rules)  
- [📝 Change Log](#-change-log)  
- [💡 How to Propose Changes](#-how-to-propose-changes)  
- [🔢 How Votes Are Counted](#-how-votes-are-counted)  
- [📌 Pinning & Permissions](#-pinning--permissions)  
- [⚙️ Applying Rules & Automation](#-applying-rules--automation)  
- [🧪 Testing / Debugging Tips](#-testing--debugging-tips)  
- [🔧 Appendix: Examples & Scripts](#-appendix-examples--scripts)

---

## 🏛️ Governance Overview

- **Weekly, two-stage poll**:
  1. **Stage 1 — Announcement & Suggestions.** Jester posts a playful announcement and pins it. Community replies with suggestions. 📣
  2. **Stage 2 — Final Vote.** After 24 hours, the system selects the top suggestions (by likes, deduped by author) and posts a final vote. After another 24 hours the winner is declared and pinned. 🕘➡️🕘
- **Selection policy:** Stage 1 picks top suggestions by `public_metrics.like_count`. Deduplication ensures one suggestion per author in the top list. 👍
- **Final voting:** Stage 2 accepts numeric replies (1..N); only the first valid reply per user counts. 🧾
- **Safety:** `CUSTOM:` proposals are recorded but **not** auto-applied by default. Only `ADD_RULE:` and `REMOVE_RULE:` are applied automatically if enabled. 🔒

---

## 🗳️ Two-stage Weekly Poll (Flow)

1. **Stage 1 — Post Announcement** 📣  
   - Jester posts a short, playful announcement and pins it. The announcement invites community suggestions for rule changes.  
   - The announcement remains pinned for the stage duration.

2. **Collect Replies (24h)** ⏳  
   - System collects replies (conversation replies). Rank by `like_count`. Dedupe by author.  
   - Pick top **N** (default 5) suggestions. If zero suggestions, stage1 closes with no advancement and an admin note. ⚠️

3. **Stage 2 — Post Final Vote** 🗳️  
   - The system posts the final vote with the selected suggestions (numbered `1..N`) and pins it.  
   - Stage2 remains open for 24 hours.

4. **Collect Votes (24h)** ✔️  
   - System collects replies to the stage2 tweet, parses numeric votes, accepts first valid vote per author.  
   - Winner: highest vote count; tie-breaker is the lower option id.

5. **Final Announcement** 🏁  
   - Announcement of final result, pin attempt, and update change log. The final result is stored in `data/poll.json` and the rules change log is appended.

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
