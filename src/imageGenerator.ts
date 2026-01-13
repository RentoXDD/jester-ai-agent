// src/imageGenerator.ts
import { llm } from "./openaiClient.js"; // Groq client
import { CONFIG } from "./config.js";
import { loadRules } from "./rules.js";
import { log } from "./logger.js";

/**
 * Проверить промпт на совпадение с запрещёнными правилами.
 */
async function validateImagePrompt(prompt: string) {
  const rules = loadRules();
  const banned = [...(rules?.banned ?? []), ...(rules?.safety ?? []), ...(rules?.style ?? [])].filter((r: any) => r && r.enabled);
  for (const r of banned) {
    try {
      if (r.type === "regex") {
        const re = new RegExp(r.value, "i");
        if (re.test(prompt)) throw new Error(`Image prompt rejected by rule ${r.id}`);
      } else {
        if (typeof r.value === "string" && prompt.toLowerCase().includes(r.value.toLowerCase())) {
          throw new Error(`Image prompt rejected by rule ${r.id}`);
        }
      }
    } catch (e) {
      // если regex сломан — безопасно пропускаем (не ломаем генерацию)
    }
  }
}

/**
 * Построить описательный безопасный промпт для генерации картинки
 */
function buildImagePrompt(topic: string, context: string, tweetText?: string) {
  const style = CONFIG.image?.style || "neon pixel-art frog jester, puppetmaster vibes, cinematic";
  const base = `${style}.`;
  const byTweet = tweetText ? `Concept: ${tweetText}.` : "";
  const ctx = context ? `${context}.` : "";
  return `${base} ${byTweet} Illustrate: ${topic}. ${ctx} No text overlays, no logos, no emoji, square composition. If including public figures, render as stylized caricature (NOT photorealistic).`;
}

/**
 * Попытаться сгенерировать изображение через Groq (llm.images.generate).
 * Возвращает Buffer(PNG) или бросает ошибку.
 */
export async function generateImageForPost(topic: string, context: string, tweetText?: string): Promise<Buffer> {
  const prompt = buildImagePrompt(topic, context, tweetText);
  await validateImagePrompt(prompt);

  // имя модели для изображений у Groq (можно задать через env)
  const model = process.env.GROQ_IMAGE_MODEL || process.env.GROQ_MODEL_IMAGE || "gpt-image-1";

  try {
    // Используем тот же llm (OpenAI SDK, настроенный на Groq baseURL).
    // Метод images.generate() обычно доступен в SDK.
    const resp: any = await (llm as any).images.generate({
      model,
      prompt,
      size: `${CONFIG.image.width}x${CONFIG.image.height}`,
    });

    // стандартные места, где может быть base64
    const b64 = resp?.data?.[0]?.b64_json || resp?.data?.[0]?.b64 || resp?.data?.[0]?.image_base64 || (resp?.images && resp.images[0]);
    if (!b64) throw new Error("No image returned from Groq images endpoint");
    return Buffer.from(b64, "base64");
  } catch (err: any) {
    log("ERROR", "Groq image generation failed", { error: String(err?.message ?? err) });
    throw err;
  }
}
