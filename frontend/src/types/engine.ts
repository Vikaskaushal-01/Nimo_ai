// Mirrors backend/src/shared/engine.types.ts — the stable API contract.

export type MetricKey =
  | "semanticSimilarity"
  | "completeness"
  | "accuracy"
  | "reasoning"
  | "readability"
  | "contextPreservation";

export type MetricScores = Record<MetricKey, number>;

export interface RankedResponse {
  model: string;
  label: string;
  vendor: string;
  content: string;
  latencyMs: number;
  tokens: { prompt: number; completion: number; total: number };
  costUsd: number;
  metrics: MetricScores;
  weightedScore: number;
  hallucinationRisk: number;
  rank: number;
  score: number;
  confidence: number;
}

export interface ContributionEntry {
  section: string;
  models: string[];
}

export interface FailedResponse {
  model: string;
  label: string;
  error: string;
}

export interface RetrievedSource {
  documentId: string;
  filename: string;
  chunkIndex: number;
  score: number;
  snippet: string;
  content?: string;
}

export interface DecisionMeta {
  totalLatencyMs: number;
  fromCache: boolean;
  requestedModels: string[];
  failedModels: FailedResponse[];
  provider: string;
  sources?: RetrievedSource[];
}

export interface DecisionResult {
  conversationId: string;
  messageId: string;
  prompt: string;
  optimizedAnswer: string;
  reasoningSummary: string;
  contributionMap: ContributionEntry[];
  ranking: RankedResponse[];
  meta: DecisionMeta;
}

export interface ModelInfo {
  id: string;
  label: string;
  vendor: string;
  contextWindow: number;
  pricing: { promptPer1k: number; completionPer1k: number };
  enabled: boolean;
}

export interface Conversation {
  _id: string;
  title: string;
  messageCount: number;
  lastModelSet: string[];
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage extends Omit<DecisionResult, "conversationId" | "messageId"> {
  _id: string;
  conversationId: string;
  requestedModels: string[];
  createdAt: string;
}

export type AnswerStyle = "balanced" | "concise" | "detailed";

export const METRIC_LABELS: Record<MetricKey, string> = {
  semanticSimilarity: "Semantic",
  completeness: "Completeness",
  accuracy: "Accuracy",
  reasoning: "Reasoning",
  readability: "Readability",
  contextPreservation: "Context",
};
