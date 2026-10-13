import { Router } from "express";
import { mongoHealth } from "../../infrastructure/mongo.js";
import { redisHealth } from "../../infrastructure/redis.js";
import { ok } from "../../shared/ApiResponse.js";
import { useMockProvider } from "../../config/env.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  const mongo = mongoHealth();
  const redis = redisHealth();
  const status = mongo === "up" ? "ok" : "degraded";
  // 503 when the database is down so load balancers / orchestrators can react.
  ok(res, {
    status,
    uptimeSeconds: Math.round(process.uptime()),
    services: {
      mongo,
      redis,
      aiProvider: useMockProvider ? "mock" : "openrouter",
    },
    timestamp: new Date().toISOString(),
  }, mongo === "up" ? 200 : 503);
});
