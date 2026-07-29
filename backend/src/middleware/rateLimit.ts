import rateLimit from "express-rate-limit";

/** Generous global limiter — protects against accidental floods. */
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many requests", statusCode: 429 } },
});

/** Tighter limiter for the expensive multi-AI decision endpoint. */
export const decisionLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: "Too many decision requests, slow down", statusCode: 429 },
  },
});
