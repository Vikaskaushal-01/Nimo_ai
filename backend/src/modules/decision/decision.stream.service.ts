import { env, useMockProvider } from "../../config/env.js";
import { cacheGet, cacheSet } from "../../infrastructure/redis.js";
import { logger } from "../../shared/logger.js";
import type {
  DecisionResult,
  FailedResponse,
  RankedResponse,
} from "../../shared/engine.types.js";
import { findModel } from "../../config/providers.js";
import { evaluateResponses } from "../evaluation/evaluation.service.js";
import { fuseResponses } from "../fusion/fusion.service.js";
import { orchestrateStream } from "../orchestration/orchestrator.service.js";
import { rankResponses } from "../ranking/ranking.service.js";
import { persistDecision } from "../chat/chat.service.js";
import { resolveContext } from "./decision.context.js";
import {
  decisionCacheKey,
  isRagRequest,
  type DecisionInput,
  type DecisionResponse,
} from "./decision.service.js";

/** Pipeline stages surfaced to the client as progress markers. */
export type DecisionStage =
  | "retrieving"
  | "querying"
  | "evaluating"
  | "ranking"
  | "fusing"
  | "saving";

/** Events emitted over SSE during a streaming decision. */
export type DecisionStreamEvent =
  | { type: "start"; models: { id: string; label: string; vendor: string }[] }
  | { type: "token"; model: string; delta: string }
  | { type: "model_done"; model: string; latencyMs: number; tokens: number; costUsd: number }
  | { type: "model_error"; model: string; label: string; error: string }
  | { type: "stage"; stage: DecisionStage }
  | { type: "ranked"; ranking: RankedResponse[] }
  | { type: "done"; result: DecisionResponse }
  | { type: "error"; message: string };

export type Emit = (event: DecisionStreamEvent) => void;

/**
 * Streaming Multi-AI Decision pipeline. Emits live token deltas per model, then
 * stage markers as it evaluates → ranks → fuses, and finally the persisted
 * result. Mirrors `runDecision` but optimized for real-time UX.
 */
export const runDecisionStream = async (
  input: DecisionInput,
  emit: Emit,
  signal?: AbortSignal,
): Promise<void> => {
  const { prompt, models, ownerId, conversationId } = input;
  const startedAt = Date.now();

  emit({
    type: "start",
    models: models.map((id) => {
      const d = findModel(id);
      return { id, label: d?.label ?? id, vendor: d?.vendor ?? "" };
    }),
  });

  // ── Cache fast-path: no streaming, return the stored result immediately. ──
  const key = decisionCacheKey(input);
  const cached = key ? await cacheGet<DecisionResult>(key) : null;
  if (cached) {
    logger.info("Decision cache hit (stream)", { models });
    emit({ type: "ranked", ranking: cached.ranking });
    emit({ type: "stage", stage: "saving" });
    const result: DecisionResult = {
      ...cached,
      meta: { ...cached.meta, fromCache: true, totalLatencyMs: Date.now() - startedAt },
    };
    const ids = await persistDecision(result, ownerId, conversationId);
    emit({ type: "done", result: { ...result, ...ids } });
    return;
  }

  // ── 1. Retrieve RAG context (optional) ────────────────────────────────────
  if (isRagRequest(input)) emit({ type: "stage", stage: "retrieving" });
  const { augmentedPrompt, sources } = await resolveContext({
    ownerId,
    prompt,
    useKnowledgeBase: input.useKnowledgeBase,
    documentIds: input.documentIds,
  });

  // ── 2. Orchestrate with live token streaming ──────────────────────────────
  emit({ type: "stage", stage: "querying" });
  const failed: FailedResponse[] = [];
  const { responses } = await orchestrateStream(augmentedPrompt, models, {
    onToken: (model, delta) => emit({ type: "token", model, delta }),
    onModelDone: (r) =>
      emit({
        type: "model_done",
        model: r.model,
        latencyMs: r.latencyMs,
        tokens: r.tokens.total,
        costUsd: r.costUsd,
      }),
    onModelError: (f) => {
      failed.push(f);
      emit({ type: "model_error", model: f.model, label: f.label, error: f.error });
    },
  }, { signal, style: input.style });

  // Client went away: don't spend more tokens on evaluation/fusion or persist
  // a half-finished decision nobody is waiting for.
  if (signal?.aborted) return;

  if (responses.length === 0) {
    emit({ type: "error", message: "All models failed to respond." });
    return;
  }

  // ── 3. Evaluate ───────────────────────────────────────────────────────────
  emit({ type: "stage", stage: "evaluating" });
  const evaluated = await evaluateResponses(prompt, responses);

  // ── 4. Rank (emit early so cards get scores before fusion completes) ──────
  emit({ type: "stage", stage: "ranking" });
  const ranking = rankResponses(evaluated);
  emit({ type: "ranked", ranking });

  // ── 5. Fuse ───────────────────────────────────────────────────────────────
  emit({ type: "stage", stage: "fusing" });
  const fusion = await fuseResponses(prompt, ranking, input.style);
  if (signal?.aborted) return;

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

  // ── 6. Cache + persist ────────────────────────────────────────────────────
  emit({ type: "stage", stage: "saving" });
  if (key) await cacheSet(key, result, env.DECISION_CACHE_TTL);
  const ids = await persistDecision(result, ownerId, conversationId);

  emit({ type: "done", result: { ...result, ...ids } });
};
