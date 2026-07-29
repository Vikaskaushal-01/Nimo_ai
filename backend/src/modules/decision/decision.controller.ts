import { z } from "zod";
import { MODEL_CATALOG, enabledModels } from "../../config/providers.js";
import { AppError } from "../../shared/AppError.js";
import { ok } from "../../shared/ApiResponse.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { currentUser } from "../../middleware/auth.js";
import { logger } from "../../shared/logger.js";
import { runDecision } from "./decision.service.js";
import { runDecisionStream, type DecisionStreamEvent } from "./decision.stream.service.js";

const enabledIds = new Set(enabledModels().map((m) => m.id));

export const decisionSchema = z.object({
  prompt: z.string().trim().min(1, "Prompt is required").max(20_000),
  models: z
    .array(z.string())
    .min(1, "Select at least one model")
    .max(8, "At most 8 models per request"),
  conversationId: z.string().optional(),
  useKnowledgeBase: z.boolean().optional(),
  documentIds: z.array(z.string()).max(50).optional(),
});

export const createDecisionHandler = asyncHandler(async (req, res) => {
  const body = req.body as z.infer<typeof decisionSchema>;

  // Reject unknown/disabled models with a clear 400 before doing any work.
  const invalid = body.models.filter((m) => !enabledIds.has(m));
  if (invalid.length > 0) {
    throw AppError.badRequest(`Unknown or disabled model(s): ${invalid.join(", ")}`, {
      invalid,
    });
  }
  const unique = [...new Set(body.models)];

  const result = await runDecision({
    prompt: body.prompt,
    models: unique,
    ownerId: currentUser(req).sub,
    conversationId: body.conversationId,
    useKnowledgeBase: body.useKnowledgeBase,
    documentIds: body.documentIds,
  });

  ok(res, result, 201, { fromCache: result.meta.fromCache });
});

/**
 * Streaming variant over Server-Sent Events. Emits live token deltas per model
 * plus pipeline stage markers, then the final persisted result. Uses POST (not
 * EventSource) so the request carries the Bearer token and JSON body.
 */
export const streamDecisionHandler = asyncHandler(async (req, res) => {
  const body = req.body as z.infer<typeof decisionSchema>;

  const invalid = body.models.filter((m) => !enabledIds.has(m));
  if (invalid.length > 0) {
    throw AppError.badRequest(`Unknown or disabled model(s): ${invalid.join(", ")}`, { invalid });
  }
  const unique = [...new Set(body.models)];

  // SSE headers.
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable proxy buffering (nginx)
  res.flushHeaders?.();

  let closed = false;
  const send = (event: DecisionStreamEvent) => {
    if (closed) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Stop work if the client disconnects mid-stream.
  req.on("close", () => {
    closed = true;
  });

  // Heartbeat comment keeps intermediaries from closing an idle connection.
  const heartbeat = setInterval(() => {
    if (!closed) res.write(": ping\n\n");
  }, 15_000);

  try {
    await runDecisionStream(
      {
        prompt: body.prompt,
        models: unique,
        ownerId: currentUser(req).sub,
        conversationId: body.conversationId,
        useKnowledgeBase: body.useKnowledgeBase,
        documentIds: body.documentIds,
      },
      send,
    );
  } catch (err) {
    logger.error("Streaming decision failed", { error: String(err) });
    send({ type: "error", message: err instanceof Error ? err.message : "Decision failed" });
  } finally {
    clearInterval(heartbeat);
    if (!closed) res.end();
  }
});

/** Exposes the model catalog so the frontend selector stays config-driven. */
export const listModelsHandler = asyncHandler(async (_req, res) => {
  ok(
    res,
    MODEL_CATALOG.map((m) => ({
      id: m.id,
      label: m.label,
      vendor: m.vendor,
      contextWindow: m.contextWindow,
      pricing: m.pricing,
      enabled: m.enabled,
    })),
  );
});
