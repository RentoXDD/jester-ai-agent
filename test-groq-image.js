// test-groq-image.js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
});

async function main() {
  try {
    const resp = await client.images.generate({
      model: "gpt-image-1",            // попробуйте gpt-image-1 или groq-аналог
      prompt: "neon pixel-art frog jester, puppetmaster vibes, cinematic",
      size: "1024x1024"
    });
    console.log("OK:", resp);
  } catch (err) {
    console.error("ERROR:", String(err));
  }
}
main();
