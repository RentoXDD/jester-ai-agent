# Rules & Governance for Jester AI Agent

**Last updated:** 2026-01-12T00:00:00Z

This document is the authoritative human-readable description of the governance system used by the Jester AI Agent: how rule proposals are collected, how votes are held, how final decisions are recorded, and the canonical change log of rules.

> The runtime state is also stored in `data/poll.json` and rules may be stored in `data/rules.json`. This document supplements those files with explanations and the narrative changelog for humans.

---

## Table of contents

- [Governance Overview](#governance-overview)  
- [Two-stage Weekly Poll (Flow)](#two-stage-weekly-poll-flow)  
- [Rule Schema](#rule-schema)  
- [Current Active Rules](#current-active-rules)  
- [Change Log](#change-log)  
- [How to Propose Changes](#how-to-propose-changes)  
- [How Votes Are Counted](#how-votes-are-counted)  
- [Pinning & Permissions](#pinning--permissions)  
- [Applying Rules & Automation](#applying-rules--automation)  
- [Testing / Debugging Tips](#testing--debugging-tips)  
- [Appendix: Examples & Scripts](#appendix-examples--scripts)

---

## Governance Overview

- **Weekly, two-stage poll**:
  1. **Stage 1 — Announcement & Suggestions.** Jester posts a jester-voiced announcement (ends with `❓❓❓❗❗❗` and `ribbit`) and pins it. Community replies with suggestions.
  2. **Stage 2 — Final Vote.** After 24 hours, system selects the top suggestions (by likes, deduped by author) and posts a final vote. After another 24 hours the winner is declared and pinned.
- **Stage 1 selects suggestions** by `public_metrics.like_count`. Deduplication ensures one suggestion per author in the top list.
- **Stage 2 votes** are collected as replies containing the option number; only the first valid vote per author counts.
- **Safety**: `CUSTOM:` proposals are recorded but **not** auto-applied by default. Only `ADD_RULE:` and `REMOVE_RULE:` are auto-applied if the rules engine supports it.

---

## Two-stage Weekly Poll (Flow)

1. **Stage 1 — Post Announcement**
   - Jester posts a short jester-voiced announcement, pins it, and opens stage1 for 24 hours.
   - Announcement always ends in `❓❓❓❗❗❗` and `ribbit`.

2. **Collect Replies (24h)**
   - System collects replies to the stage1 tweet and ranks them by `like_count`.
   - Deduplicate by author (one selected suggestion per author).
   - Pick top **N** (default 5) suggestions. If zero suggestions, stage1 closes with no advancement.

3. **Stage 2 — Post Final Vote**
   - System posts the final vote containing the selected suggestions (numbered `1..N`), pins it, and opens stage2 for 24 hours.

4. **Collect Votes (24h)**
   - System collects replies to the stage2 tweet.
   - Each reply is parsed for a valid option number. First valid vote per user counts.
   - Winner = highest vote count; tie-breaker = lower option id.

5. **Final Announcement**
   - System posts and tries to pin the final announcement with the result. The final is persisted in `data/poll.json` and logged in the changelog.

---

## Rule Schema

Rules are stored as JSON objects. Example `data/rules.json`:

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
