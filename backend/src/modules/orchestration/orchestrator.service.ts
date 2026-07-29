import { env } from "../../config/env.js";
import { findModel } from "../../config/providers.js";
import { logger } from "../../shared/logger.js";
import type { FailedResponse, NormalizedResponse } from "../../shared/engine.types.js";
import { getProvider } from "../ai/provider.registry.js";
import type { ChatMessage } from "../ai/provider.types.js";

export interface OrchestrationOutput {
  responses: NormalizedResponse[];
  failed: FailedResponse[];
}

export interface OrchestrationStreamHandlers {
  /** A token chunk arrived for `model`. */
  onToken: (model: string, delta: string) => void;
  /** `model` finished successfully. */
  onModelDone: (response: NormalizedResponse) => void;
  /** `model` failed. */
  onModelError: (failure: FailedResponse) => void;
}

const SYSTEM_PROMPT: ChatMessage = {
  role: "system",
  content:
    "You are a helpful, accurate expert assistant. Answer clearly and completely, " +
    "using markdown structure (headings, lists, code blocks) where helpful.",
};

/**
 * Runs a single model, optionally streaming token deltas. Captures latency,
 * token usage and cost. Throws on unknown model / transport errors / timeout.
 */
const runModel = async (
  prompt: string,
  model: string,
  onDelta?: (delta: string) => void,
): Promise<NormalizedResponse> => {
  const provider = getProvider();
  const descriptor = findModel(model);
  if (!descriptor) throw new Error(`Unknown model '${model}' (not in catalog)`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.AI_REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const messages = [SYSTEM_PROMPT, { role: "user" as const, content: prompt }];
    const res = onDelta
      ? await provider.chatStream({ model, messages, temperature: 0.7, signal: controller.signal }, onDelta)
      : await provider.chat({ model, messages, temperature: 0.7, signal: controller.signal });

    const latencyMs = Date.now() - startedAt;
    const costUsd =
      (res.usage.promptTokens / 1000) * descriptor.pricing.promptPer1k +
      (res.usage.completionTokens / 1000) * descriptor.pricing.completionPer1k;

    return {
      model,
      label: descriptor.label,
      vendor: descriptor.vendor,
      content: res.content,
      latencyMs,
      tokens: {
        prompt: res.usage.promptTokens,
        completion: res.usage.completionTokens,
        total: res.usage.totalTokens,
      },
      costUsd: Number(costUsd.toFixed(6)),
    };
  } finally {
    clearTimeout(timer);
  }
};

const toFailure = (model: string, err: unknown): FailedResponse => {
  const error = err instanceof Error ? err.message : String(err);
  logger.warn("Model failed during orchestration", { model, error });
  return { model, label: findModel(model)?.label ?? model, error };
};

/**
 * Fans out the prompt to every requested model IN PARALLEL, enforcing a
 * per-request timeout. Failures degrade gracefully — a slow/broken model is
 * excluded and surfaced in `failed`, the rest still produce a decision.
 */
export const orchestrate = async (
  prompt: string,
  models: string[],
): Promise<OrchestrationOutput> => {
  const settled = await Promise.allSettled(models.map((m) => runModel(prompt, m)));

  const responses: NormalizedResponse[] = [];
  const failed: FailedResponse[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value.content.trim().length > 0) {
      responses.push(result.value);
    } else {
      const reason = result.status === "rejected" ? result.reason : "Empty response";
      failed.push(toFailure(models[i], reason));
    }
  });
  return { responses, failed };
};

/**
 * Streaming variant: identical fan-out, but emits token deltas live and fires
 * onModelDone / onModelError as each model settles (not after all complete).
 */
export const orchestrateStream = async (
  prompt: string,
  models: string[],
  handlers: OrchestrationStreamHandlers,
): Promise<OrchestrationOutput> => {
  const responses: NormalizedResponse[] = [];
  const failed: FailedResponse[] = [];

  await Promise.all(
    models.map(async (model) => {
      try {
        const res = await runModel(prompt, model, (delta) => handlers.onToken(model, delta));
        if (res.content.trim().length === 0) throw new Error("Empty response");
        responses.push(res);
        handlers.onModelDone(res);
      } catch (err) {
        const failure = toFailure(model, err);
        failed.push(failure);
        handlers.onModelError(failure);
      }
    }),
  );

  return { responses, failed };
};
