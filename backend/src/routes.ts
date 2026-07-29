import { Router } from "express";
import { requireAuth } from "./middleware/auth.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { decisionRouter } from "./modules/decision/decision.routes.js";
import { chatRouter } from "./modules/chat/chat.routes.js";
import { ragRouter } from "./modules/rag/rag.routes.js";
import { analyticsRouter } from "./modules/analytics/analytics.routes.js";

/** Aggregates every module router under the versioned /api/v1 mount. */
export const apiRouter = Router();

// Public.
apiRouter.use(healthRouter);
apiRouter.use(authRouter);

// Authenticated — everything below requires a valid access token.
apiRouter.use(requireAuth);
apiRouter.use(decisionRouter);
apiRouter.use(chatRouter);
apiRouter.use(ragRouter);
apiRouter.use(analyticsRouter);
