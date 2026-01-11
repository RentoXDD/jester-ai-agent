// src/generator.ts
import { llm, MODEL } from "./openaiClient.js";
import { buildSystemPrompt } from "./rulesEngine.js";
import { CONFIG } from "./config.js";

/**
 * Low-level text generation helper.
 * - Uses rulesEngine to construct the system prompt
 * - Adds a hard max-char hint into the user prompt
 */
export async function generateText(
  prompt: string,
  opts?: { maxChars?: number; mode?: "tweet" | "reply" }
) {
  const mode = opts?.mode ?? "tweet";
  const maxChars =
    typeof opts?.maxChars === "number" && opts.maxChars > 0
      ? Math.floor(opts.maxChars)
      : mode === "reply"
        ? (CONFIG as any).maxReplyChars ?? 200
        : (CONFIG as any).maxTweetChars ?? 260;

  const system = buildSystemPrompt({ mode });

  const promptWithLimit =
    `${prompt.trim()}\n` +
    `Hard limit: ${maxChars} characters.\n` +
    `Return ONLY the final text.`;

  const resp = await llm.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: promptWithLimit },
    ],
    temperature: (CONFIG as any).temperature ?? 1.0,
  });

  return resp.choices[0]?.message?.content ?? "";
}

export async function generateTweet(args: {
  topic: string;
  context: string;
  successPatterns: any[];
  failPatterns: any[];
  recentPosts: string[];
}) {
  const { topic, context, successPatterns, failPatterns, recentPosts } = args;

  const avoid = (failPatterns ?? [])
    .map((p: any) => p?.text)
    .filter(Boolean)
    .join(" | ");

  const prefer = (successPatterns ?? [])
    .map((p: any) => p?.text)
    .filter(Boolean)
    .join(" | ");

  const dontRepeat = (recentPosts ?? []).filter(Boolean).join(" || ");

  const maxChars = (CONFIG as any).maxTweetChars ?? 260;

  const prompt =
    `Write ONE short rude clever meme-style joke tweet as an American frog mascot for a memecoin.\n` +
    `Topic: ${topic}\n` +
    `Context: ${context}\n` +
    (avoid ? `Avoid: ${avoid}\n` : "") +
    (prefer ? `Prefer: ${prefer}\n` : "") +
    (dontRepeat ? `Don't repeat: ${dontRepeat}\n` : "") +
    `Must end with "ribbit."`;

  return generateText(prompt, { maxChars, mode: "tweet" });
}

export async function generateReply(args: {
  userText: string;
  lastPost: string;
  successPatterns: any[];
  failPatterns: any[];
}) {
  const { userText, lastPost, successPatterns, failPatterns } = args;

  const avoid = (failPatterns ?? [])
    .map((p: any) => p?.text)
    .filter(Boolean)
    .join(" | ");

  const prefer = (successPatterns ?? [])
    .map((p: any) => p?.text)
    .filter(Boolean)
    .join(" | ");

  const maxChars = (CONFIG as any).maxReplyChars ?? 200;

  const prompt =
    `Reply on X as Jester.\n` +
    `User: "${userText}"\n` +
    `Last post: "${lastPost}"\n` +
    (avoid ? `Avoid: ${avoid}\n` : "") +
    (prefer ? `Prefer: ${prefer}\n` : "") +
    `Reply 1–2 sentences.\n` +
    `Must end with "ribbit."`;

  return generateText(prompt, { maxChars, mode: "reply" });
}
