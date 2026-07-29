import { createHash } from "node:crypto";
import { env, useMockProvider } from "../../config/env.js";
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
}

export interface DecisionResponse extends DecisionResult {
  conversationId: string;
  messageId: string;
}

/** Cache key derived from the prompt + model set + RAG scope. */
export const decisionCacheKey = (
  prompt: string,
  models: string[],
  documentIds: string[] = [],
): string => {
  const normalizedModels = [...models].sort().join("|");
  const normalizedDocs = [...documentIds].sort().join("|");
  const hash = createHash("sha256")
    .update(`${prompt}::${normalizedModels}::${normalizedDocs}`)
    .digest("hex");
  return `decision:${hash}`;
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
  const key = decisionCacheKey(prompt, models, input.documentIds);

  // ── 1. Cache lookup ──────────────────────────────────────────────────────
  const cached = await cacheGet<DecisionResult>(key);
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
  const { responses, failed } = await orchestrate(augmentedPrompt, models);

  // ── 4. Evaluate every response ───────────────────────────────────────────
  const evaluated = await evaluateResponses(prompt, responses);

  // ── 5. Rank + confidence (sums to 100) ───────────────────────────────────
  const ranking = rankResponses(evaluated);

  // ── 6. Fuse into one optimized answer ────────────────────────────────────
  const fusion = await fuseResponses(prompt, ranking);

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
  if (ranking.length > 0) {
    await cacheSet(key, result, env.DECISION_CACHE_TTL);
  }
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
