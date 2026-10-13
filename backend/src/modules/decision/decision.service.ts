import { createHash } from "node:crypto";
import { env, useMockProvider } from "../../config/env.js";
import { AppError } from "../../shared/AppError.js";
import type { AnswerStyle } from "../../shared/answerStyle.js";
import { cacheGet, cacheSet } from "../../infrastructure/redis.js";
import { logger } from "../../shared/logger.js";
import type { DecisionResult } from "../../shared/engine.types.js";
import { evaluateResponses } from "../evaluation/evaluation.service.js";
import { fuseResponses } from "../fusion/fusion.service.js";
import { orchestrate } from "../orchestration/orchestrator.service.js";
import { rankResponses } from "../ranking/ranking.service.js";
import { persistDecision } from "../chat/chat.service.js";
import { resolveContext } from "./decision.context.js";

export interface DecisionInput {
  prompt: string;
  models: string[];
  ownerId: string;
  conversationId?: string;
  /** Inject retrieved knowledge-base context into the prompt. */
  useKnowledgeBase?: boolean;
  /** Restrict RAG retrieval to these documents (implies useKnowledgeBase). */
  documentIds?: string[];
  /** Answer length/depth; defaults to "balanced". */
  style?: AnswerStyle;
}

export interface DecisionResponse extends DecisionResult {
  conversationId: string;
  messageId: string;
}

/** True when the request asks for knowledge-base (RAG) grounding. */
export const isRagRequest = (input: Pick<DecisionInput, "useKnowledgeBase" | "documentIds">): boolean =>
  !!input.useKnowledgeBase || (input.documentIds?.length ?? 0) > 0;

/**
 * Shared cache key for a plain (non-RAG) decision: prompt + model set.
 *
 * Returns null for RAG requests — those answers embed the owner's private
 * document snippets and depend on the current state of their knowledge base,
 * so they must never be served from a cache shared across users or uploads.
 */
export const decisionCacheKey = (input: DecisionInput): string | null => {
  if (isRagRequest(input)) return null;
  const normalizedModels = [...input.models].sort().join("|");
  const hash = createHash("sha256")
    .update(`${input.prompt}::${normalizedModels}::${input.style ?? "balanced"}`)
    .digest("hex");
  return `decision:v2:${hash}`;
};

/**
 * The full Multi-AI Decision pipeline:
 *   (retrieve RAG context) → orchestrate → evaluate → rank → fuse → persist.
 * The expensive engine output is cached in Redis keyed by (prompt + models +
 * RAG scope); persistence still runs on a cache hit so every send is recorded.
 */
export const runDecision = async (input: DecisionInput): Promise<DecisionResponse> => {
  const { prompt, models, ownerId, conversationId } = input;
  const startedAt = Date.now();
  const key = decisionCacheKey(input);

  // ── 1. Cache lookup ──────────────────────────────────────────────────────
  const cached = key ? await cacheGet<DecisionResult>(key) : null;
  if (cached) {
    logger.info("Decision cache hit", { models });
    const result: DecisionResult = {
      ...cached,
      meta: { ...cached.meta, fromCache: true, totalLatencyMs: Date.now() - startedAt },
    };
    const ids = await persistDecision(result, ownerId, conversationId);
    return { ...result, ...ids };
  }

  // ── 2. Retrieve RAG context (optional) ───────────────────────────────────
  const { augmentedPrompt, sources } = await resolveContext({
    ownerId,
    prompt,
    useKnowledgeBase: input.useKnowledgeBase,
    documentIds: input.documentIds,
  });

  // ── 3. Orchestrate (parallel fan-out) ────────────────────────────────────
  const { responses, failed } = await orchestrate(augmentedPrompt, models, { style: input.style });
  if (responses.length === 0) {
    throw AppError.upstream("All models failed to respond.", { failedModels: failed });
  }

  // ── 4. Evaluate every response ───────────────────────────────────────────
  const evaluated = await evaluateResponses(prompt, responses);

  // ── 5. Rank + confidence (sums to 100) ───────────────────────────────────
  const ranking = rankResponses(evaluated);

  // ── 6. Fuse into one optimized answer ────────────────────────────────────
  const fusion = await fuseResponses(prompt, ranking, input.style);

  const result: DecisionResult = {
    prompt,
    optimizedAnswer: fusion.optimizedAnswer,
    reasoningSummary: fusion.reasoningSummary,
    contributionMap: fusion.contributionMap,
    ranking,
    meta: {
      totalLatencyMs: Date.now() - startedAt,
      fromCache: false,
      requestedModels: models,
      failedModels: failed,
      provider: useMockProvider ? "mock" : "openrouter",
      ...(sources.length > 0 ? { sources } : {}),
    },
  };

  // ── 7. Cache + persist ───────────────────────────────────────────────────
  if (key) await cacheSet(key, result, env.DECISION_CACHE_TTL);
  const ids = await persistDecision(result, ownerId, conversationId);

  logger.info("Decision complete", {
    models: models.length,
    succeeded: responses.length,
    failed: failed.length,
    sources: sources.length,
    latencyMs: result.meta.totalLatencyMs,
  });

  return { ...result, ...ids };
};
