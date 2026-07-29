// Mirrors backend/src/modules/analytics/analytics.service.ts.

import type { MetricScores } from "./engine";

export interface ModelStat {
  model: string;
  label: string;
  vendor: string;
  appearances: number;
  wins: number;
  winRate: number;
  avgScore: number;
  avgConfidence: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCostUsd: number;
  avgHallucinationRisk: number;
}

export interface VendorStat {
  vendor: string;
  appearances: number;
  wins: number;
  costUsd: number;
}

export interface TimePoint {
  date: string;
  decisions: number;
  tokens: number;
  costUsd: number;
  avgLatencyMs: number;
}

export interface AnalyticsOverview {
  range: { days: number; from: string; to: string };
  totals: {
    decisions: number;
    conversations: number;
    totalTokens: number;
    totalCostUsd: number;
    avgLatencyMs: number;
    modelsCompared: number;
    responses: number;
  };
  metricAverages: MetricScores;
  models: ModelStat[];
  vendors: VendorStat[];
  timeseries: TimePoint[];
}
