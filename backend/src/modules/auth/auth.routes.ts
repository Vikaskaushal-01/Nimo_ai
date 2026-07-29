import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  loginHandler,
  loginSchema,
  logoutHandler,
  meHandler,
  refreshHandler,
  refreshSchema,
  registerHandler,
  registerSchema,
} from "./auth.controller.js";

// Tight limiter to blunt credential stuffing / brute force.
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many auth attempts, try later", statusCode: 429 } },
});

export const authRouter = Router();

authRouter.post("/auth/register", authLimiter, validate(registerSchema), registerHandler);
authRouter.post("/auth/login", authLimiter, validate(loginSchema), loginHandler);
authRouter.post("/auth/refresh", validate(refreshSchema), refreshHandler);
authRouter.post("/auth/logout", logoutHandler);
authRouter.get("/auth/me", requireAuth, meHandler);
