import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const LOG_DIR = path.resolve("agent_logs");
const LAST_ERROR_LOG = path.join(LOG_DIR, "last_error.log");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const MAX_RESTARTS = 10; // protect against an infinite restart loop
const COOLDOWN_MS = 30_000; // 30s cooldown before restart
let restartCount = 0;

/**
 * Start the main bot.
 */
function startBot() {
  console.log("\n🟢 Starting bot...");

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

    // Persist the last error to a file
    fs.writeFileSync(LAST_ERROR_LOG, stderrBuf.slice(-20000), "utf8");
  });

  bot.on("close", async (code) => {
    console.log(`\n🔴 Bot exited with code: ${code}`);

    if (code === 0) {
      console.log("✅ Bot closed normally. Watchdog stopped.");
      process.exit(0);
    }

    // If there are too many restarts, stop to avoid looping forever
    restartCount++;
    if (restartCount > MAX_RESTARTS) {
      console.log("❌ Too many restarts. Stopping watchdog.");
      process.exit(1);
    }

    console.log("⚠️ Bot crashed. Starting fixer...");
    const fixed = await runFixer();

    if (!fixed) {
      console.log("❌ Fixer failed. Waiting before retry...");
      await sleep(COOLDOWN_MS);
      return startBot();
    }

    console.log("✅ Fixer applied changes. Restarting bot...");
    await sleep(3000);
    startBot();
  });
}

/**
 * Start fixer.ts
 */
function runFixer(): Promise<boolean> {
  return new Promise((resolve) => {
    const fixer = spawn("npx", ["tsx", "agent/fixer.ts", LAST_ERROR_LOG], {
      shell: true,
      env: process.env,
    });

    fixer.stdout.on("data", (data) => {
      process.stdout.write(data.toString());
    });

    fixer.stderr.on("data", (data) => {
      process.stderr.write(data.toString());
    });

    fixer.on("close", (code) => {
      console.log(`\n🛠️ fixer exited with code: ${code}`);
      resolve(code === 0);
    });
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// === start watchdog ===
startBot();
