// src/imageGenerator.ts
import { llm } from "./openaiClient.js"; // Groq client (OpenAI SDK configured to Groq)
import { CONFIG } from "./config.js";
import { loadRules } from "./rules.js";
import { log } from "./logger.js";
import OpenAI from "openai";

/**
 * Validate image prompt against banned/safety/style rules.
 */
async function validateImagePrompt(prompt: string) {
  const rules = loadRules();
  const banned = [
    ...(rules?.banned ?? []),
    ...(rules?.safety ?? []),
    ...(rules?.style ?? []),
  ].filter((r: any) => r && r.enabled);

  for (const r of banned) {
    try {
      if (r.type === "regex") {
        const re = new RegExp(r.value, "i");
        if (re.test(prompt)) throw new Error(`Image prompt rejected by rule ${r.id}`);
      } else if (typeof r.value === "string" && r.value.trim()) {
        if (prompt.toLowerCase().includes(r.value.toLowerCase())) {
          throw new Error(`Image prompt rejected by rule ${r.id}`);
        }
      }
    } catch (e) {
      // if regex malformed, skip that rule for safety
    }
  }
}

/**
 * Build a safe, descriptive prompt for generation.
 */
function buildImagePrompt(topic: string, context: string, tweetText?: string) {
  const style = CONFIG.image?.style || "neon pixel-art frog jester, puppetmaster vibes, cinematic";
  const byTweet = tweetText ? `Concept: ${tweetText}.` : "";
  const ctx = context ? `${context}.` : "";
  return `${style}. ${byTweet} Illustrate: ${topic}. ${ctx} No text overlays, no logos, no emoji, no real-world brand marks. If including public figures, render as stylized caricature (NOT photorealistic). Square composition ${CONFIG.image.width}x${CONFIG.image.height}.`;
}

/**
 * Extract base64 from a variety of response shapes.
 */
function extractBase64(resp: any): string | null {
  if (!resp) return null;
  if (Array.isArray(resp?.data) && resp.data[0]?.b64_json) return resp.data[0].b64_json;
  if (Array.isArray(resp?.data) && resp.data[0]?.b64) return resp.data[0].b64;
  if (Array.isArray(resp?.data) && resp.data[0]?.image_base64) return resp.data[0].image_base64;
  if (resp?.images && Array.isArray(resp.images) && resp.images[0]) return resp.images[0];
  // Groq/OpenAI variations
  return null;
}

/**
 * Try to generate image using Groq (llm)
 */
async function tryGroq(prompt: string): Promise<Buffer> {
  const model = process.env.GROQ_IMAGE_MODEL || "gpt-image-1";
  try {
    const resp: any = await (llm as any).images.generate({
      model,
      prompt,
      size: `${CONFIG.image.width}x${CONFIG.image.height}`,
    });
    const b64 = extractBase64(resp);
    if (!b64) throw new Error("Groq returned no image data");
    return Buffer.from(b64, "base64");
  } catch (err: any) {
    throw new Error("Groq image error: " + (err?.message ?? String(err)));
  }
}

/**
 * Try OpenAI images as fallback (optional)
 */
async function tryOpenAI(prompt: string): Promise<Buffer> {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY not set");
    const client = new OpenAI({ apiKey: key });
    const resp: any = await client.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      prompt,
      size: `${CONFIG.image.width}x${CONFIG.image.height}`,
    });
    const b64 = extractBase64(resp);
    if (!b64) throw new Error("OpenAI returned no image data");
    return Buffer.from(b64, "base64");
  } catch (err: any) {
    throw new Error("OpenAI image error: " + (err?.message ?? String(err)));
  }
}

/**
 * Public: generate an image Buffer for a post.
 * Tries Groq first, optionally falls back to OpenAI if configured.
 */
export async function generateImageForPost(topic: string, context: string, tweetText?: string): Promise<Buffer> {
  const prompt = buildImagePrompt(topic, context, tweetText);
  await validateImagePrompt(prompt);

  // Try Groq
  try {
    return await tryGroq(prompt);
  } catch (e) {
    log("WARN", "Groq image generation failed, trying fallback if available", { error: String(e?.message ?? e) });
  }

  // Optional fallback to OpenAI
  try {
    return await tryOpenAI(prompt);
  } catch (e) {
    log("WARN", "OpenAI image generation failed (fallback)", { error: String(e?.message ?? e) });
  }

  throw new Error("Image generation failed for all providers.");
}
