import type { MetricKey } from "../config/providers.js";

/** A single model's raw response after normalization. */
export interface NormalizedResponse {
  model: string;
  label: string;
  vendor: string;
  content: string;
  latencyMs: number;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  costUsd: number;
}

/** A model that failed to respond (timeout / upstream error). */
export interface FailedResponse {
  model: string;
  label: string;
  error: string;
}

/** Per-metric scores in [0,1]. */
export type MetricScores = Record<MetricKey, number>;

/** A normalized response enriched with evaluation scores. */
export interface EvaluatedResponse extends NormalizedResponse {
  metrics: MetricScores;
  /** Weighted aggregate in [0,1]. */
  weightedScore: number;
  /** Probability-ish risk in [0,1]; higher = more likely hallucinating. */
  hallucinationRisk: number;
}

/** Final ranked entry exposed to clients. */
export interface RankedResponse extends EvaluatedResponse {
  rank: number;
  /** Score on a 0–100 scale (weightedScore * 100, rounded to 1dp). */
  score: number;
  /** Integer confidence percentage; the set sums to exactly 100. */
  confidence: number;
}

/** Which models contributed to a section of the fused answer. */
export interface ContributionEntry {
  section: string;
  models: string[];
}

/** Output of the fusion engine. */
export interface FusionResult {
  optimizedAnswer: string;
  reasoningSummary: string;
  contributionMap: ContributionEntry[];
}

/** A knowledge-base chunk retrieved for RAG context injection. */
export interface RetrievedSource {
  documentId: string;
  filename: string;
  chunkIndex: number;
  /** Cosine similarity to the query, 0–1. */
  score: number;
  /** Short preview for display. */
  snippet: string;
  /** Full chunk text (used to build the prompt context block). */
  content: string;
}

/** The complete result returned by the decision pipeline. */
export interface DecisionResult {
  prompt: string;
  optimizedAnswer: string;
  reasoningSummary: string;
  contributionMap: ContributionEntry[];
  ranking: RankedResponse[];
  meta: {
    totalLatencyMs: number;
    fromCache: boolean;
    requestedModels: string[];
    failedModels: FailedResponse[];
    provider: string;
    /** Sources injected as RAG context, if the knowledge base was used. */
    sources?: RetrievedSource[];
  };
}
