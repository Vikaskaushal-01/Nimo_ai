import { env } from "../../config/env.js";
import { findModel } from "../../config/providers.js";
import { logger } from "../../shared/logger.js";
import { styleInstruction, type AnswerStyle } from "../../shared/answerStyle.js";
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

export interface RunOptions {
  /** Caller cancellation (e.g. the SSE client disconnected). */
  signal?: AbortSignal;
  style?: AnswerStyle;
}

const systemPrompt = (style?: AnswerStyle): ChatMessage => ({
  role: "system",
  content:
    "You are a helpful, accurate expert assistant. Answer clearly and completely, " +
    "using markdown structure (headings, lists, code blocks) where helpful." +
    styleInstruction(style),
});

/**
 * Runs a single model, optionally streaming token deltas. Captures latency,
 * token usage and cost. Throws on unknown model / transport errors / timeout.
 */
const runModel = async (
  prompt: string,
  model: string,
  onDelta?: (delta: string) => void,
  { signal: parentSignal, style }: RunOptions = {},
): Promise<NormalizedResponse> => {
  const provider = getProvider();
  const descriptor = findModel(model);
  if (!descriptor) throw new Error(`Unknown model '${model}' (not in catalog)`);

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`Timed out after ${env.AI_REQUEST_TIMEOUT_MS} ms`)),
    env.AI_REQUEST_TIMEOUT_MS,
  );
  // Propagate caller cancellation (e.g. the SSE client disconnected).
  const onParentAbort = () => controller.abort(new Error("Request cancelled"));
  if (parentSignal?.aborted) onParentAbort();
  parentSignal?.addEventListener("abort", onParentAbort, { once: true });
  const startedAt = Date.now();
  try {
    const messages = [systemPrompt(style), { role: "user" as const, content: prompt }];
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
  } catch (err) {
    // Surface the abort reason (timeout / cancelled) instead of a generic "canceled".
    if (controller.signal.aborted && controller.signal.reason instanceof Error) {
      throw controller.signal.reason;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onParentAbort);
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
  options: RunOptions = {},
): Promise<OrchestrationOutput> => {
  const settled = await Promise.allSettled(models.map((m) => runModel(prompt, m, undefined, options)));

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
  options: RunOptions = {},
): Promise<OrchestrationOutput> => {
  const responses: NormalizedResponse[] = [];
  const failed: FailedResponse[] = [];

  await Promise.all(
    models.map(async (model) => {
      try {
        const res = await runModel(prompt, model, (delta) => handlers.onToken(model, delta), options);
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
