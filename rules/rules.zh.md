<table width="100%"><tr><td align="left">
🌐 语言：<a href="../README.md">English 🇺🇸</a> | <a href="../README.zh.md">中文 🇨🇳</a>
</td></tr><tr><td align="right"> &nbsp; • &nbsp;
<a href="../README.zh.md">📘 中文首页</a> &nbsp; • &nbsp;
<a href="./CURRENT_RULES.zh.md"> 📜 当前规则（中文）</a>
</td></tr></table>

# 🤡 规则与治理 — Jester AI Agent（中文）

**🕒 最后更新：** 2026-01-12T00:00:00Z

本文件为 Jester 的中文治理权威说明（面向社区、审计与运营）。内容包含：治理流程、规则数据格式、投票与计票细则、自动化与上链建议、变更日志、运维与应急流程等。  
**注意**：机器可读的权威来源为 `data/rules.json`；自动化脚本 `scripts/update_rules.js` 会在每次投票终结时更新 `rules/CURRENT_RULES.zh.md` 与本变更日志，并提交到仓库（CI 环境需具备相应推送权限）。

---

## 📚 目录

- 🧭 [治理概览](#治理概览)  
- 🗳️ [周度双阶段投票（Two-stage）流程](#周度双阶段投票two-stage流程)  
- 🧾 [规则数据结构（Rule Schema）](#规则数据结构rule-schema)  
- ✅ [当前生效规则（Current Rules）](#当前生效规则current-rules)  
- 📝 [变更日志（Change Log）](#变更日志change-log)  
- ✍️ [如何提交提案（Propose）](#如何提交提案propose)  
- 🔢 [计票与验证规则](#计票与验证规则)  
- ⚙️ [自动化、上链与多签建议](#自动化上链与多签建议)  
- 📌 [Pin 与权限（Pin & Permissions）](#pin-与权限pin--permissions)  
- 🛠️ [运维与快速排障（Ops）](#运维与快速排障ops)  
- 📎 [附录：示例与脚本](#附录示例与脚本)  
- 📬 [联系人与责任人](#联系人与责任人)

---

## 治理概览

Jester 的人格与行为由社区规则驱动。治理目标是：

- 🔍 **公开透明**：变更有完整日志与审计痕迹；  
- 🤝 **社区主导**：规则由社区提议并投票决定；  
- 🛡️ **最小化信任（trust-minimized）**：关键权限建议走多签或链上治理以避免单点控制。

设计原则：快速迭代 + 可回溯审计 + 高风险多签保护。

---

## 周度双阶段投票（Two-stage）流程

**总体思路**：先征集并以社群热度筛选候选，再由社区对候选进行最终投票决定规则变更。流程类似 Snapshot + off-chain 排位，便于快速迭代与审计。

### 1️⃣ Stage 1 — 公示与征集（24 小时）
- Jester 发布本周征集公告（品牌化口吻）。社区在回复区提交建议（支持结构化前缀：`ADD_RULE:`、`REMOVE_RULE:`、`CUSTOM:`）。  
- 建议通过点赞（like）决定 Stage1 的排序权重（点赞越多越靠前）。  
- 去重规则：每位作者在候选中仅保留一条（默认保留该作者点赞数最高的一条）。

### 2️⃣ Stage 2 — 决选投票（24 小时）
- 从 Stage1 候选中取 Top N（默认 5）作为最终选项，Jester 发布带编号的最终投票贴。  
- 社区以回复数字（1..N）投票：每位作者的第一条有效回复计为其投票权。票数最高者获胜；若平票，编号较小者为胜。

### ✅ 结果公布与执行
- 若获胜项为 `ADD_RULE:` 或 `REMOVE_RULE:`，自动化可（在项目允许自动应用时）更新 `data/rules.json` 并生效。  
- 若为 `CUSTOM:`，建议先经多签或 DAO 审核，再决定是否转为 `ADD_RULE:` 并应用，避免任意文本直接生效的风险。  
- 自动化会把最终结果写入变更日志，并生成中英文两套当前规则视图以供查阅和审计。

---

## 规则数据结构（Rule Schema） 🧾

规则以 JSON 存储于 `data/rules.json`。单条示例：

```json
{
  "id": "format-short",
  "text": "Prefer short posts and short sentences.",
  "enabled": true,
  "addedAt": "2025-10-01T12:00:00Z",
  "source": "manual",
  "notes": "Initial rule"
}
