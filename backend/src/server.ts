import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { connectMongo, disconnectMongo } from "./infrastructure/mongo.js";
import { disconnectRedis, getRedis } from "./infrastructure/redis.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { requestId } from "./middleware/requestId.js";
import { apiRouter } from "./routes.js";
import { getProvider } from "./modules/ai/provider.registry.js";
import { logger } from "./shared/logger.js";

const app = express();

// ── Security & parsing middleware ──────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestId);
app.use(
  morgan(env.NODE_ENV === "production" ? "combined" : "dev", {
    skip: (req) => req.path === "/api/v1/health",
  }),
);
app.use(globalLimiter);

// ── Routes ─────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({ name: "Multi-AI Decision Engine API", version: "v1", docs: "/api/v1/health" });
});
app.use("/api/v1", apiRouter);

// ── Error handling (must be last) ──────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Bootstrap ──────────────────────────────────────────────────────────────
const start = async (): Promise<void> => {
  await connectMongo();
  getRedis(); // eager-connect so health reflects real status
  getProvider(); // log which provider is active

  const server = app.listen(env.BACKEND_PORT, () => {
    logger.info(`🚀 API listening on http://localhost:${env.BACKEND_PORT}/api/v1`, {
      env: env.NODE_ENV,
    });
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    server.close();
    await Promise.allSettled([disconnectMongo(), disconnectRedis()]);
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

start().catch((err) => {
  logger.error("Fatal startup error", { error: String(err) });
  process.exit(1);
});

export { app };
