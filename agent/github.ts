// agent/github.ts
import { spawnSync } from "child_process";
import { Octokit } from "@octokit/rest";
import path from "path";

function runGit(args: string[], cwd: string) {
  const r = spawnSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
  const out = r.stdout?.toString() ?? "";
  const err = r.stderr?.toString() ?? "";
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${err.trim()}`);
  }
  return out.trim();
}

export async function gitCommitAndCreatePR(cwd: string, message: string) {
  console.log("[GIT] add .");
  runGit(["add", "."], cwd);

  console.log("[GIT] status");
  const status = runGit(["status", "--porcelain"], cwd);
  if (!status) {
    console.log("[GIT] No changes to commit.");
    return null;
  }

  console.log("[GIT] commit");
  try {
    runGit(["commit", "-m", message], cwd);
  } catch (e: any) {
    // Nothing to commit
    console.log("[GIT] Commit skipped:", e.message);
  }

  const branch = `auto-fix/${Date.now()}`;
  console.log(`[GIT] create branch ${branch}`);
  runGit(["checkout", "-b", branch], cwd);

  console.log("[GIT] push branch");
  // push branch upstream
  runGit(["push", "-u", "origin", branch], cwd);

  const token = process.env.GH_PAT || process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GH_PAT or GITHUB_TOKEN is required to create PR");

  const repoEnv = process.env.GITHUB_REPOSITORY;
  if (!repoEnv) {
    // try to infer from git
    const originUrl = runGit(["config", "--get", "remote.origin.url"], cwd);
    // originUrl may be like: git@github.com:owner/repo.git or https://github.com/owner/repo.git
    const m = originUrl.match(/[:/](.+)\/(.+?)(?:\.git)?$/);
    if (!m) throw new Error("Cannot determine repository (set GITHUB_REPOSITORY env)");
  }
  const [owner, repoName] = (repoEnv ?? "").split("/");

  const octokit = new Octokit({ auth: token });

  console.log("[GIT] create PR via Octokit");
  const pr = await octokit.pulls.create({
    owner,
    repo: repoName,
    title: message,
    head: branch,
    base: "main",
    body: "Automated fix from Jester agent (tests passed).",
  });

  console.log("[GIT] PR created:", pr.data.html_url);
  return pr.data.html_url;
}
