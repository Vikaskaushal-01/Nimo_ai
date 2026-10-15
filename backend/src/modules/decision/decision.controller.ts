import { z } from "zod";
import { MODEL_CATALOG, enabledModels } from "../../config/providers.js";
import { AppError } from "../../shared/AppError.js";
import { ANSWER_STYLES } from "../../shared/answerStyle.js";
import { ok } from "../../shared/ApiResponse.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { currentUser } from "../../middleware/auth.js";
import { logger } from "../../shared/logger.js";
import { assertConversationOwned } from "../chat/chat.service.js";
import { loadHistory, loadInstructions } from "./decision.context.js";
import { runDecision, type DecisionInput } from "./decision.service.js";
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
  style: z.enum(ANSWER_STYLES).optional(),
  regenerate: z.boolean().optional(),
});

type DecisionBody = z.infer<typeof decisionSchema>;

/**
 * Validates everything that would otherwise only fail AFTER the expensive model
 * calls: unknown/disabled models and a conversation the caller doesn't own.
 * Returns the de-duplicated model list.
 */
const preflight = async (body: DecisionBody, ownerId: string): Promise<string[]> => {
  const invalid = body.models.filter((m) => !enabledIds.has(m));
  if (invalid.length > 0) {
    throw AppError.badRequest(`Unknown or disabled model(s): ${invalid.join(", ")}`, { invalid });
  }
  if (body.conversationId) await assertConversationOwned(body.conversationId, ownerId);
  return [...new Set(body.models)];
};

/** Validated request → pipeline input, with conversation memory and custom instructions. */
const toInput = async (body: DecisionBody, ownerId: string, models: string[]): Promise<DecisionInput> => {
  const [history, instructions] = await Promise.all([
    loadHistory(body.conversationId),
    loadInstructions(ownerId),
  ]);
  return {
    prompt: body.prompt,
    models,
    ownerId,
    conversationId: body.conversationId,
    useKnowledgeBase: body.useKnowledgeBase,
    documentIds: body.documentIds,
    style: body.style,
    regenerate: body.regenerate,
    history,
    instructions,
  };
};

export const createDecisionHandler = asyncHandler(async (req, res) => {
  const body = req.body as DecisionBody;
  const ownerId = currentUser(req).sub;
  const unique = await preflight(body, ownerId);

  const result = await runDecision(await toInput(body, ownerId, unique));

  ok(res, result, 201, { fromCache: result.meta.fromCache });
});

/**
 * Streaming variant over Server-Sent Events. Emits live token deltas per model
 * plus pipeline stage markers, then the final persisted result. Uses POST (not
 * EventSource) so the request carries the Bearer token and JSON body.
 */
export const streamDecisionHandler = asyncHandler(async (req, res) => {
  const body = req.body as DecisionBody;
  const ownerId = currentUser(req).sub;
  // Runs before the SSE headers go out, so failures are normal JSON errors.
  const unique = await preflight(body, ownerId);
  const input = await toInput(body, ownerId, unique);

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

  // Stop work (and the upstream model calls) if the client disconnects.
  // Listen on the response: the request body was already consumed by the JSON
  // parser, so the request's own "close" event does not signal a disconnect.
  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) {
      closed = true;
      abort.abort();
    }
  });

  // Heartbeat comment keeps intermediaries from closing an idle connection.
  const heartbeat = setInterval(() => {
    if (!closed) res.write(": ping\n\n");
  }, 15_000);

  try {
    await runDecisionStream(input, send, abort.signal);
  } catch (err) {
    logger.error("Streaming decision failed", { requestId: req.id, error: String(err) });
    // Only operational errors carry a message that is safe to show the client.
    send({
      type: "error",
      message: err instanceof AppError ? err.message : "Decision failed. Please try again.",
    });
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
