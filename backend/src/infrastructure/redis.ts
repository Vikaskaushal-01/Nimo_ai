import Redis from "ioredis";
import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";

/**
 * Lazy Redis singleton. Caching is best-effort: if Redis is unavailable the
 * app degrades gracefully (cache misses) rather than failing requests.
 */
let client: Redis | null = null;
// Log connection errors once per outage instead of on every retry.
let errorLogged = false;

export const getRedis = (): Redis => {
  if (client) return client;
  client = new Redis(env.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    // Fail fast while disconnected instead of queueing commands.
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });
  client.on("error", (err) => {
    if (errorLogged) return;
    errorLogged = true;
    logger.warn("Redis unavailable — caching disabled until it reconnects", { error: String(err) });
  });
  client.on("ready", () => {
    errorLogged = false;
    logger.info("Redis connected");
  });
  return client;
};

const isReady = (): boolean => getRedis().status === "ready";

/** Get a JSON value; returns null on miss or any error. */
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  try {
    if (!isReady()) return null;
    const raw = await getRedis().get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

/** Set a JSON value with TTL (seconds). Best-effort. */
export const cacheSet = async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
  try {
    if (ttlSeconds <= 0 || !isReady()) return;
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
