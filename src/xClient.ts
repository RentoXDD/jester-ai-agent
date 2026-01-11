import { TwitterApi } from "twitter-api-v2";
import { CONFIG } from "./config.js";
import { log } from "./logger.js";

let _client: TwitterApi | null = null;

function readEnv(name: string): string {
  // CONFIG can be undefined if config.ts is not exporting correctly
  const fromConfig = (CONFIG as any)?.[name];
  const fromEnv = process.env[name];
  return String(fromConfig ?? fromEnv ?? "").trim();
}

function buildClient(): TwitterApi {
  const appKey = readEnv("X_APP_KEY");
  const appSecret = readEnv("X_APP_SECRET");
  const accessToken = readEnv("X_ACCESS_TOKEN");
  const accessSecret = readEnv("X_ACCESS_SECRET");

  // Log only lengths (do not leak secrets)
  log("INFO", "X auth present (lengths)", {
    X_APP_KEY_len: appKey.length,
    X_APP_SECRET_len: appSecret.length,
    X_ACCESS_TOKEN_len: accessToken.length,
    X_ACCESS_SECRET_len: accessSecret.length,
  });

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    throw new Error(
      "Missing X credentials. Check GitHub Secrets: X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET."
    );
  }

  // twitter-api-v2 may throw "Invalid consumer tokens" right here
  return new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  });
}

export function getXClient(): TwitterApi {
  if (_client) return _client;
  _client = buildClient();
  return _client;
}

/**
 * Export xClient so it is NOT created on module import.
 * Initialization happens only on first access to xClient.v1 / xClient.v2.
 */
export const xClient: TwitterApi = new Proxy({} as TwitterApi, {
  get(_target, prop) {
    const c = getXClient() as any;
    return c[prop];
  },
}) as TwitterApi;
