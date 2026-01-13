// src/imageGenerator.ts
import { CONFIG } from "./config.js";
import fs from "node:fs/promises";
import { loadRules } from "./rules.js";

export async function validateImagePrompt(prompt: string) {
  const rules = loadRules();
  const banned = [...rules.banned, ...rules.safety, ...rules.style].filter((r) => r && r.enabled);
  for (const r of banned) {
    try {
      if (r.type === "regex") {
        const re = new RegExp(r.value, "i");
        if (re.test(prompt)) throw new Error(`Image prompt rejected by rule ${r.id}`);
      } else {
        if (String(prompt).toLowerCase().includes(String(r.value).toLowerCase())) {
          throw new Error(`Image prompt rejected by rule ${r.id}`);
        }
      }
    } catch (e) {
      // if regex invalid, skip it to avoid breaking generation
      if (r.type === "regex") {
        // log? skip
      }
    }
  }
}

function buildImagePrompt(topic: string, context: string) {
  // concise, descriptive, safe
  const style = CONFIG.image.style || "neon pixel-art frog jester, puppetmaster vibes, cinematic";
  return `${style}. Illustrate: ${topic}. ${context}. No text overlays, no logos, no emoji, no real-world brand marks. If including public figures, render as stylized caricature (NOT photorealistic). Square 1:1 composition ${CONFIG.image.width}x${CONFIG.image.height}.`;
}

/**
 * Return Buffer (PNG) for the generated image.
 */
export async function generateImageForPost(topic: string, context: string): Promise<Buffer> {
  const prompt = buildImagePrompt(topic, context);
  await validateImagePrompt(prompt);

  if ((CONFIG.image.provider || "openai").toLowerCase() === "openai") {
    // Use OpenAI images API (gpt-image-1). Ensure OPENAI_API_KEY is set.
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: CONFIG.image.openaiApiKey });
    // Note: client.images.generate availability depends on SDK version.
    const resp: any = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: `${CONFIG.image.width}x${CONFIG.image.height}`,
      // format: "png" - some SDKs accept this
    });
    // SDK commonly returns base64 in resp.data[0].b64_json
    const b64 = resp?.data?.[0]?.b64_json || resp?.data?.[0]?.b64;
    if (!b64) throw new Error("No image returned from OpenAI images endpoint");
    return Buffer.from(b64, "base64");
  } else {
    // Stable Diffusion HTTP API (AUTOMATIC1111 / other)
    const url = (CONFIG.image.sdApiUrl || "").replace(/\/$/, "") + "/sdapi/v1/txt2img";
    if (!CONFIG.image.sdApiUrl) throw new Error("SD_API_URL not configured");
    const body = {
      prompt,
      width: CONFIG.image.width,
      height: CONFIG.image.height,
      steps: 20,
      cfg_scale: 7.0,
      sampler_name: "Euler a",
    };
    const headers: any = { "Content-Type": "application/json" };
    if (CONFIG.image.sdApiKey) headers["Authorization"] = `Bearer ${CONFIG.image.sdApiKey}`;

    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`SD image generation failed: ${res.status} ${txt}`);
    }
    const json = await res.json();
    const b64 = json?.images?.[0];
    if (!b64) throw new Error("No image returned from SD");
    return Buffer.from(b64, "base64");
  }
}
