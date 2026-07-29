import dotenv from "dotenv";
import { z } from "zod";

// Load .env from the backend dir and the repo root (compose passes most vars
// through env_file, but local `npm run dev` reads ../.env at the repo root).
dotenv.config();
dotenv.config({ path: "../.env" });

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BACKEND_PORT: z.coerce.number().int().positive().default(4000),

  OPENROUTER_API_KEY: z.string().trim().default(""),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  OPENROUTER_APP_URL: z.string().default("http://localhost:5173"),
  OPENROUTER_APP_TITLE: z.string().default("Multi-AI Decision Engine"),

  FUSION_MODEL: z.string().default("openai/gpt-4o-mini"),
  EMBEDDING_MODEL: z.string().default("openai/text-embedding-3-small"),

  // --- Auth ---
  JWT_ACCESS_SECRET: z.string().min(16).default("dev-access-secret-change-me-please"),
  JWT_REFRESH_SECRET: z.string().min(16).default("dev-refresh-secret-change-me-please"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(10),

  MONGO_URI: z.string().default("mongodb://localhost:27017/multi_ai"),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  DECISION_CACHE_TTL: z.coerce.number().int().nonnegative().default(3600),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable message — never boot with invalid config.
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment configuration:");
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/** True when no real provider key is configured → use the MockProvider. */
export const useMockProvider = env.OPENROUTER_API_KEY.length === 0;

// Warn loudly if running production on the built-in dev JWT secrets.
if (
  env.NODE_ENV === "production" &&
  (env.JWT_ACCESS_SECRET.includes("change-me") || env.JWT_REFRESH_SECRET.includes("change-me"))
) {
  // eslint-disable-next-line no-console
  console.warn("⚠️  Running in production with default JWT secrets. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET.");
}

export type Env = typeof env;
