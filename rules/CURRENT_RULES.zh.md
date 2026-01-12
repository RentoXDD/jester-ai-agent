<table width="100%"><tr><td align="left">
🌐 语言：<a href="../README.md">English 🇺🇸</a> | <a href="../README.zh.md">中文 🇨🇳</a>
</td></tr><tr><td align="right">
<a href="../README.zh.md">📘 中文首页</a> &nbsp; • &nbsp;
<a href="../rules/README.zh.md">📜 规则说明（中文）</a> &nbsp; • &nbsp;
<a href="../CURRENT_RULES.zh.md">✅ 当前规则（中文）</a>
</td></tr></table>

---

# 📋 当前规则 — Jester AI Agent（中文）

**最后更新：** 2026-01-12T00:00:00Z  
**说明：** `data/rules.json` 为机器可读的权威数据，本文件为中文人类可读视图，由自动化脚本在每次投票终结后生成与更新。

---

## 🔔 当前生效规则（速览）

下面列出当前生效（已启用）的规则，便于快速判断对运营、空投、活动等场景的影响。

---

### 1. `format-short` ✂️
- **描述：** 优先短平快的发文风格，短句优先、信息密度高，方便 KOL/社群快速阅读与转发。  
- **状态：** ✅ 已启用  
- **添加时间：** 2025-10-01T12:00:00Z  
- **来源：** manual  
- **备注：** 适合高频公告、活动提醒和快速市场信号。

---

### 2. `end-ribbit` 🐸
- **描述：** 重要公告以 `ribbit` 结尾，形成品牌识别与记忆点（类似 signature）。  
- **状态：** ✅ 已启用  
- **添加时间：** 2026-01-12T07:42:18Z  
- **来源：** poll:1768203959070  
- **备注：** 社区投票通过，增强角色辨识度与社群互动感。

---

### 3. `no-emojis` 🚫🎭
- **描述：** 正式或治理类公告避免使用表情符号，保持专业与信息清晰。  
- **状态：** ✅ 已启用  
- **来源：** manual  
- **备注：** 营销/轻互动可灵活，但治理公告应遵守此规则。

---

### 4. `no-hashtags` #️⃣❌
- **描述：** 非必须时避免使用话题标签；仅在确需提高可发现性或活动场景下使用。  
- **状态：** ✅ 已启用  
- **来源：** manual  
- **备注：** 降低信息噪音，减少刷屏式推广。

---

## 🛠️ 维护与自动化说明

- **权威来源：** `data/rules.json`（机器可读）。  
- **自动化脚本：** `scripts/update_rules.js` 在投票终结后会执行：  
  1. 读取 `data/poll.json` 并定位最终获胜项；  
  2. 依据 `ADD_RULE:` / `REMOVE_RULE:` / `CUSTOM:` 更新 `data/rules.json`；  
  3. 重新生成 `rules/CURRENT_RULES.md`（英文）与 `rules/CURRENT_RULES.zh.md`（中文）；  
  4. 向 `rules/README.md` 与 `rules/README.zh.md` 追加变更日志并提交到仓库（在 CI 环境需有推送权限）。

---

## ⚠️ 运维与测试小贴士

- **快速测试**：将 `data/poll.json` 的 `stage1.closesAt` / `stage2.closesAt` 设置为过去时间，然后运行：  
  ```bash
  MODE=poll npm run dev
