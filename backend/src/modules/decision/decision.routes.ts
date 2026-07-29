import { Router } from "express";
import { decisionLimiter } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import {
  createDecisionHandler,
  decisionSchema,
  listModelsHandler,
  streamDecisionHandler,
} from "./decision.controller.js";

export const decisionRouter = Router();

decisionRouter.get("/models", listModelsHandler);
decisionRouter.post(
  "/decision",
  decisionLimiter,
  validate(decisionSchema),
  createDecisionHandler,
);
decisionRouter.post(
  "/decision/stream",
  decisionLimiter,
  validate(decisionSchema),
  streamDecisionHandler,
);
