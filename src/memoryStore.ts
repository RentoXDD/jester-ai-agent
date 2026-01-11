// src/memoryStore.ts (fixed version)
import fs from "node:fs";
import path from "node:path";
import { PATHS } from "./config.js";

type PatternType = "success" | "avoid";

export type MemoryPost = {
  tweet_id: string;
  content: string;
  topic: string;
  context: string;
  ts?: number;
};

export type Pattern = {
  text: string;
  score?: number;
  ts?: number;
};

type MemoryShape = {
  posts: MemoryPost[];
  patterns: {
    success: Pattern[];
    avoid: Pattern[];
  };
  state: Record<string, any>;
};

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function safeReadJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson(file: string, data: any) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

const DEFAULT_MEMORY: MemoryShape = {
  posts: [],
  patterns: { success: [], avoid: [] },
  state: {},
};

function toCamel(s: string) {
  return s.replace(/_([a-z])/g, (_m, p1) => p1.toUpperCase());
}

export class MemoryStore {
  private mem: MemoryShape;

  constructor() {
    // PATHS names: use DATA_DIR and MEMORY_FILE (as in config.ts)
    ensureDir(PATHS.DATA_DIR);
    this.mem = safeReadJson<MemoryShape>(PATHS.MEMORY_FILE, DEFAULT_MEMORY);

    if (!this.mem.posts) this.mem.posts = [];
    if (!this.mem.patterns) this.mem.patterns = { success: [], avoid: [] };
    if (!this.mem.patterns.success) this.mem.patterns.success = [];
    if (!this.mem.patterns.avoid) this.mem.patterns.avoid = [];
    if (!this.mem.state) this.mem.state = {};

    this.flush();
  }

  flush() {
    safeWriteJson(PATHS.MEMORY_FILE, this.mem);
  }

  getRecentPosts(n = 10): MemoryPost[] {
    return [...this.mem.posts].slice(-n);
  }

  addPost(p: MemoryPost) {
    this.mem.posts.push({ ...p, ts: p.ts ?? Date.now() });
    if (this.mem.posts.length > 300) this.mem.posts = this.mem.posts.slice(-300);
    this.flush();
  }

  getPatterns(type: PatternType, n = 10): Pattern[] {
    const arr = this.mem.patterns[type] ?? [];
    return [...arr].slice(-n);
  }

  addPattern(type: PatternType, text: string, score = 1) {
    this.mem.patterns[type] = this.mem.patterns[type] ?? [];
    this.mem.patterns[type].push({ text, score, ts: Date.now() });
    if (this.mem.patterns[type].length > 500) {
      this.mem.patterns[type] = this.mem.patterns[type].slice(-500);
    }
    this.flush();
  }

  // Compatible state API (getState/setState) + convenience methods
  getState(key: string): any {
    const camel = toCamel(key);
    return this.mem.state[camel] ?? this.mem.state[key];
  }

  setState(key: string, value: any) {
    const camel = toCamel(key);
    this.mem.state[camel] = value;
    this.flush();
  }

  // Legacy/convenience methods — kept for backward compatibility
  getLastMentionId(): string | undefined {
    return this.mem.state.lastMentionId ?? this.mem.state.last_mention_id;
  }

  setLastMentionId(id: string) {
    this.mem.state.lastMentionId = id;
    this.flush();
  }

  getLastPost(): MemoryPost | undefined {
    if (!this.mem.posts || this.mem.posts.length === 0) return undefined;
    return this.mem.posts[this.mem.posts.length - 1];
  }

  markMetricsRun() {
    this.mem.state.lastMetricsRun = Date.now();
    this.flush();
  }
}
