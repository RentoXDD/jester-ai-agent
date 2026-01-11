import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const LOG_DIR = path.resolve("agent_logs");
const LAST_ERROR_LOG = path.join(LOG_DIR, "last_error.log");
const LAST_BUILD_LOG = path.join(LOG_DIR, "last_build_error.log");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const MAX_RESTARTS = 12; // max consecutive restarts
const MAX_FIX_ATTEMPTS = 6; // max consecutive fix attempts
const COOLDOWN_MS = 30_000; // 30s pause between restarts
const BUILD_COOLDOWN_MS = 10_000;

let restartCount = 0;
let fixAttempts = 0;

/**
 * === ENTRY POINT ===
 */
(async function main() {
  console.log("🧠 Jester Watchdog v2 started.");

  const buildOk = await ensureBuild();
  if (!buildOk) {
    console.log("❌ Build not possible. Watchdog stopped.");
    process.exit(1);
  }

  startBot();
})();

/**
 * === 1) ensure build always exists ===
 */
async function ensureBuild(): Promise<boolean> {
  console.log("\n🔨 Running build...");

  const ok = await runCommand("npm", ["run", "build"], LAST_BUILD_LOG);

  if (ok) {
    console.log("✅ Build success.");
    fixAttempts = 0; // reset fix attempts if build succeeded
    return true;
  }

  console.log("❌ Build failed. Starting fixer...");
  fixAttempts++;

  if (fixAttempts > MAX_FIX_ATTEMPTS) {
    console.log("🛑 Too many fix attempts. Giving up.");
    return false;
  }

  const fixed = await runFixer(LAST_BUILD_LOG);
  if (!fixed) {
    console.log("❌ Fixer failed to fix build.");
    return false;
  }

  console.log("✅ Fixer patched. Retrying build...");
  await sleep(BUILD_COOLDOWN_MS);
  return await ensureBuild(); // try again recursively
}

/**
 * === 2) start bot and monitor ===
 */
function startBot() {
  console.log("\n🟢 Starting bot (npm start) ...");

  const bot = spawn("npm", ["start"], {
    shell: true,
    env: process.env,
  });

  let stderrBuf = "";

  bot.stdout.on("data", (data) => {
    process.stdout.write(data.toString());
  });

  bot.stderr.on("data", (data) => {
    const msg = data.toString();
    process.stderr.write(msg);
    stderrBuf += msg;

    fs.writeFileSync(LAST_ERROR_LOG, stderrBuf.slice(-30000), "utf8");
  });

  bot.on("close", async (code) => {
    console.log(`\n🔴 Bot exited with code: ${code}`);

    if (code === 0) {
      console.log("✅ Bot closed normally. Watchdog stopped.");
      process.exit(0);
    }

    restartCount++;
    if (restartCount > MAX_RESTARTS) {
      console.log("🛑 Too many restarts. Stopping watchdog.");
      process.exit(1);
    }

    console.log("⚠️ Bot crashed. Running fixer...");
    fixAttempts++;

    if (fixAttempts > MAX_FIX_ATTEMPTS) {
      console.log("🛑 Too many fix attempts. Stop.");
      process.exit(1);
    }

    const fixed = await runFixer(LAST_ERROR_LOG);
    if (!fixed) {
      console.log("❌ Fixer could not repair crash.");
      console.log(`⏳ Waiting ${COOLDOWN_MS / 1000}s then restarting...`);
      await sleep(COOLDOWN_MS);
      return startBot();
    }

    console.log("✅ Fix applied. Rebuilding...");
    const buildOk = await ensureBuild();

    if (!buildOk) {
      console.log("❌ Build still broken after fix. Stopping.");
      process.exit(1);
    }

    console.log("✅ Restarting bot...");
    await sleep(3000);
    startBot();
  });
}

/**
 * === run fixer.ts with error log path ===
 */
function runFixer(errorFilePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`\n🛠️ Running fixer.ts with error log: ${errorFilePath}`);

    const fixer = spawn("npx", ["tsx", "agent/fixer.ts", errorFilePath], {
      shell: true,
      env: process.env,
    });

    fixer.stdout.on("data", (data) => process.stdout.write(data.toString()));
    fixer.stderr.on("data", (data) => process.stderr.write(data.toString()));

    fixer.on("close", (code) => {
      console.log(`\n🛠️ fixer exited with code: ${code}`);
      if (code === 0) {
        console.log("✅ Fixer succeeded.");
        resolve(true);
      } else {
        console.log("❌ Fixer failed.");
        resolve(false);
      }
    });
  });
}

/**
 * === runs any command + saves last stderr ===
 */
function runCommand(cmd: string, args: string[], logPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { shell: true, env: process.env });

    let stderrBuf = "";

    proc.stdout.on("data", (data) => process.stdout.write(data.toString()));

    proc.stderr.on("data", (data) => {
      const msg = data.toString();
      process.stderr.write(msg);
      stderrBuf += msg;
      fs.writeFileSync(logPath, stderrBuf.slice(-30000), "utf8");
    });

    proc.on("close", (code) => resolve(code === 0));
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
