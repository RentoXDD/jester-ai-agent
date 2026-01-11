import { OpenAI } from "openai";
import { CONFIG } from "./config.js";

export const groq = new OpenAI({
  apiKey: CONFIG.groq.apiKey,
  baseURL: "https://api.groq.com/openai/v1"
});
