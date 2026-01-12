// src/start.ts
// Ensure poll.json exists and is valid before importing the main application.
// This script is intended to be the new dev entry point (run with `tsx src/start.ts`).

import fs from 'fs';
import path from 'path';

const pollPath = path.join(process.cwd(), 'poll.json');

function createDefaultPoll() {
  const now = new Date().toISOString();
  return {
    open: false,
    createdAt: now,
    updatedAt: now,
    // votes array and meta used as placeholders - adjust to your app schema if needed
    votes: [],
    meta: {}
  };
}

function ensurePollJson() {
  try {
    if (!fs.existsSync(pollPath)) {
      console.info(`No poll.json found at ${pollPath} — creating default poll.json`);
      fs.writeFileSync(pollPath, JSON.stringify(createDefaultPoll(), null, 2), 'utf8');
      return;
    }

    // If file exists, validate JSON
    const raw = fs.readFileSync(pollPath, 'utf8');
    try {
      JSON.parse(raw);
    } catch (err) {
      console.warn('poll.json exists but contains invalid JSON. Backing up and writing default poll.json');
      const backupPath = `${pollPath}.backup.${Date.now()}`;
      fs.renameSync(pollPath, backupPath);
      console.info(`Backed up invalid poll.json to ${backupPath}`);
      fs.writeFileSync(pollPath, JSON.stringify(createDefaultPoll(), null, 2), 'utf8');
    }
  } catch (err) {
    console.error('Failed to ensure poll.json:', err);
    // Exit to avoid confusing further CI steps if we cannot create the file
    process.exit(1);
  }
}

ensurePollJson();

// Dynamically import the main application module (src/index or src/index.ts).
// Using a dynamic import so that start.ts can run initialization first.
(async () => {
  try {
    // Import by relative path to this file's directory; this will resolve to src/index.ts when run with tsx.
    await import('./index');
  } catch (err) {
    console.error('Failed to start application (import ./index):', err);
    process.exit(1);
  }
})();
