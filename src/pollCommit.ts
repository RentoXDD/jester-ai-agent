import { execSync } from "child_process";
import { log } from "./logger.js";

function sh(cmd: string) {
  return execSync(cmd, { stdio: "pipe" }).toString("utf-8").trim();
}

function safe(cmd: string) {
  try {
    return sh(cmd);
  } catch (e: any) {
    throw new Error(`Command failed: ${cmd}\n${String(e?.message ?? e)}`);
  }
}

/**
 * Configure git remote url with token so push can happen in Actions/VPS.
 * Uses:
 *  - GH_PAT  (preferred)
 *  - GITHUB_TOKEN (actions default)
 *
 * Repo must be checked out already.
 */
function ensureAuthRemote() {
  const pat = process.env.GH_PAT || process.env.GITHUB_TOKEN;
  if (!pat) {
    log("WARN", "No GH_PAT/GITHUB_TOKEN found — will try normal git push auth");
    return;
  }

  // Detect existing remote url
  const url = safe("git remote get-url origin");
  // If already contains token, skip
  if (url.includes("@")) return;

  // Convert:
  // https://github.com/user/repo.git
  // -> https://<token>@github.com/user/repo.git
  const newUrl = url.replace("https://", `https://${pat}@`);
  safe(`git remote set-url origin "${newUrl}"`);
  log("INFO", "Git remote updated with token auth");
}

export function gitCommitAndPush(opts: {
  message: string;
  addPaths: string[];
}) {
  const { message, addPaths } = opts;

  // quick check
  safe("git rev-parse --is-inside-work-tree");

  // ensure identity (Actions often lacks it)
  try {
    safe('git config user.email');
  } catch {
    safe('git config user.email "jester-bot@users.noreply.github.com"');
  }
  try {
    safe('git config user.name');
  } catch {
    safe('git config user.name "jester-bot"');
  }

  ensureAuthRemote();

  // add
  for (const p of addPaths) {
    safe(`git add ${p}`);
  }

  // check if anything to commit
  const status = safe("git status --porcelain");
  if (!status) {
    log("INFO", "No changes to commit");
    return { ok: true, pushed: false, reason: "no_changes" };
  }

  // commit
  safe(`git commit -m "${message.replace(/"/g, '\\"')}"`);

  // push
  safe("git push origin HEAD");

  log("INFO", "Committed and pushed", { message });
  return { ok: true, pushed: true };
}
