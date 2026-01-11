// src/openaiClient.ts
import OpenAI from "openai";
import { log } from "./logger.js";

function env(name: string, fallback?: string) {
  const v = process.env[name];
  if (v && v.trim().length > 0) return v.trim();
  if (fallback !== undefined) return fallback;
  return "";
}

// IMPORTANT: OPENAI_API_KEY is NOT used here anymore.
// We only use GROQ_API_KEY.
const GROQ_API_KEY = env("GROQ_API_KEY");
if (!GROQ_API_KEY) {
  // Make the error explicit to avoid confusing “missing OPENAI_API_KEY” messages
  throw new Error("GROQ_API_KEY is missing. Add it to GitHub Secrets and workflow env.");
}

// Base URL for Groq OpenAI-compatible API
const baseURL = env("GROQ_BASE_URL", "https://api.groq.com/openai/v1");

// Read model from env, otherwise use a default
export const MODEL = env("GROQ_MODEL", "llama-3.3-70b-versatile");

// Keep the exported name “llm” so generator.ts does not need changes.
export const llm = new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL,
});

// Debug log (without the key)
log("INFO", "LLM client initialized", { provider: "groq", baseURL, model: MODEL });
