import Redis from "ioredis";
import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";

/**
 * Lazy Redis singleton. Caching is best-effort: if Redis is unavailable the
 * app degrades gracefully (cache misses) rather than failing requests.
 */
let client: Redis | null = null;

export const getRedis = (): Redis => {
  if (client) return client;
  client = new Redis(env.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
  client.on("error", (err) => {
    logger.warn("Redis error", { error: String(err) })
    console.error(err)
  });
  client.on("connect", () => logger.info("Redis connected"));
  return client;
};

/** Get a JSON value; returns null on miss or any error. */
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await getRedis().get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

/** Set a JSON value with TTL (seconds). Best-effort. */
export const cacheSet = async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
  try {
    if (ttlSeconds <= 0) return;
    await getRedis().set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    /* best-effort cache; ignore */
  }
};

export const redisHealth = (): "up" | "down" =>
  client?.status === "ready" ? "up" : "down";

export const disconnectRedis = async (): Promise<void> => {
  if (client) {
    await client.quit().catch(() => undefined);
    client = null;
  }
};
