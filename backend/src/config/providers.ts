/**
 * SINGLE SOURCE OF TRUTH for available models and evaluation weights.
 *
 * To add/remove a model the app can query, edit ONLY this file. The
 * orchestrator, evaluator, ranker, and frontend model selector all read from
 * here — no business logic changes required.
 *
 * `id` must be a valid OpenRouter model slug (https://openrouter.ai/models).
 * Prices are USD per 1,000 tokens and are used purely for cost estimation;
 * keep them roughly current but they are not safety-critical.
 */

export interface ModelPricing {
  /** USD per 1K prompt (input) tokens. */
  promptPer1k: number;
  /** USD per 1K completion (output) tokens. */
  completionPer1k: number;
}

export interface ModelDescriptor {
  /** OpenRouter slug, e.g. "openai/gpt-4o-mini". */
  id: string;
  /** Human-friendly name shown in the UI. */
  label: string;
  /** Vendor family, used only for grouping/badges. */
  vendor: string;
  pricing: ModelPricing;
  /** Approximate context window in tokens (informational). */
  contextWindow: number;
  /** When false, hidden from selection and orchestration. */
  enabled: boolean;
}

export const MODEL_CATALOG: ModelDescriptor[] = [
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "Nemotron 3 Ultra",
    vendor: "NVIDIA",
    pricing: { promptPer1k: 0, completionPer1k: 0 },
    contextWindow: 1_000_000,
    enabled: true,
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    label: "Nemotron 3 Super",
    vendor: "NVIDIA",
    pricing: { promptPer1k: 0, completionPer1k: 0 },
    contextWindow: 262_144,
    enabled: true,
  },
  {
    id: "google/gemma-4-31b-it:free",
    label: "Gemma 4 31B",
    vendor: "Google",
    pricing: { promptPer1k: 0, completionPer1k: 0 },
    contextWindow: 262_144,
    enabled: true,
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    label: "Gemma 4 26B",
    vendor: "Google",
    pricing: { promptPer1k: 0, completionPer1k: 0 },
    contextWindow: 262_144,
    enabled: true,
  },
  {
    id: "dots-studio/dots-3-note-preview:free",
    label: "dots.3 Note",
    vendor: "Dots",
    pricing: { promptPer1k: 0, completionPer1k: 0 },
    contextWindow: 512_000,
    enabled: true,
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    label: "Nemotron 3.5 Lightning",
    vendor: "NVIDIA",
    pricing: { promptPer1k: 0, completionPer1k: 0 },
    contextWindow: 1_000_000,
    enabled: true,
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    label: "Nemotron 3 Nano Reasoning",
    vendor: "NVIDIA",
    pricing: { promptPer1k: 0, completionPer1k: 0 },
    contextWindow: 256_000,
    enabled: true,
  },
  {
    id: "liquid/lfm-2.5-2.6b:free",
    label: "LFM 2.5 2.6B",
    vendor: "Liquid",
    pricing: { promptPer1k: 0, completionPer1k: 0 },
    contextWindow: 65_536,
    enabled: true,
  },
];

export const enabledModels = (): ModelDescriptor[] =>
  MODEL_CATALOG.filter((m) => m.enabled);

export const findModel = (id: string): ModelDescriptor | undefined =>
  MODEL_CATALOG.find((m) => m.id === id);

/**
 * Weighted scoring configuration. Weights MUST sum to 1.0.
 * Mirrors the spec's evaluation matrix.
 */
export const EVALUATION_WEIGHTS = {
  semanticSimilarity: 0.25,
  completeness: 0.2,
  accuracy: 0.2,
  reasoning: 0.15,
  readability: 0.1,
  contextPreservation: 0.1,
} as const;

export type MetricKey = keyof typeof EVALUATION_WEIGHTS;

// Compile-time-ish guard: surfaces a misconfigured weight table at boot.
const WEIGHT_SUM = Object.values(EVALUATION_WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(WEIGHT_SUM - 1) > 1e-9) {
  throw new Error(
    `EVALUATION_WEIGHTS must sum to 1.0 but sum to ${WEIGHT_SUM}. Fix config/providers.ts.`,
  );
}
