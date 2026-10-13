import { Conversation } from "../chat/conversation.model.js";
import { Message } from "../chat/message.model.js";
import { EVALUATION_WEIGHTS, findModel, type MetricKey } from "../../config/providers.js";
import type { MetricScores, RankedResponse } from "../../shared/engine.types.js";

const METRIC_KEYS = Object.keys(EVALUATION_WEIGHTS) as MetricKey[];

const ANALYTICS_PROJECTION = Object.fromEntries(
  [
    "createdAt",
    "meta.totalLatencyMs",
    "meta.fromCache",
    ...[
      "model", "label", "vendor", "rank", "score", "confidence",
      "latencyMs", "tokens", "costUsd", "hallucinationRisk", "metrics",
    ].map((f) => `ranking.${f}`),
  ].map((path) => [path, 1]),
);

/** Per-model rollup exposed to the dashboard. */
export interface ModelStat {
  model: string;
  label: string;
  vendor: string;
  /** How many decisions this model participated in. */
  appearances: number;
  /** How many times it ranked #1. */
  wins: number;
  /** wins / appearances, 0–1. */
  winRate: number;
  /** Mean 0–100 score. */
  avgScore: number;
  /** Mean confidence share, 0–100. */
  avgConfidence: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCostUsd: number;
  /** Mean hallucination risk, 0–1. */
  avgHallucinationRisk: number;
}

export interface VendorStat {
  vendor: string;
  appearances: number;
  wins: number;
  costUsd: number;
}

export interface TimePoint {
  /** YYYY-MM-DD (UTC). */
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
    /** Distinct models the user has compared. */
    modelsCompared: number;
    /** Total model responses evaluated (sum of ranking lengths). */
    responses: number;
  };
  /** Mean of each evaluation metric across every response, 0–1. */
  metricAverages: MetricScores;
  /** Sorted by avgScore desc. */
  models: ModelStat[];
  /** Sorted by appearances desc. */
  vendors: VendorStat[];
  /** One point per day across the range, oldest first. */
  timeseries: TimePoint[];
}

/** Running accumulator for a single model. */
interface ModelAcc {
  model: string;
  label: string;
  vendor: string;
  appearances: number;
  wins: number;
  scoreSum: number;
  confidenceSum: number;
  latencySum: number;
  tokens: number;
  costUsd: number;
  riskSum: number;
}

const utcDay = (d: Date): string => d.toISOString().slice(0, 10);

const safeAvg = (sum: number, n: number): number => (n > 0 ? sum / n : 0);

const round = (n: number, dp = 2): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/**
 * Aggregates a user's persisted decisions into dashboard-ready analytics.
 *
 * Messages are scoped to the user by joining through their conversations
 * (messages carry only `conversationId`, ownership lives on the conversation).
 * All math is done in-process over lean docs so the shape stays owned by the
 * engine types rather than leaking Mongo aggregation details to the client.
 */
export const buildOverview = async (
  ownerId: string,
  days = 30,
): Promise<AnalyticsOverview> => {
  const windowDays = Math.min(Math.max(Math.trunc(days) || 30, 1), 365);

  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - (windowDays - 1));
  from.setUTCHours(0, 0, 0, 0);

  const conversations = await Conversation.find({ ownerId }).select("_id").lean();
  const conversationIds = conversations.map((c) => c._id);

  const messages = conversationIds.length
    ? await Message.find({
        conversationId: { $in: conversationIds },
        createdAt: { $gte: from },
      })
        // Only the numeric fields aggregated below — skips every response's full
        // text and any RAG source chunks, which dominate document size.
        .select(ANALYTICS_PROJECTION)
        .lean()
    : [];

  const modelAcc = new Map<string, ModelAcc>();
  const metricSums: MetricScores = Object.fromEntries(
    METRIC_KEYS.map((k) => [k, 0]),
  ) as MetricScores;

  // Pre-seed every day in the window so the chart has no gaps.
  const buckets = new Map<string, { decisions: number; tokens: number; cost: number; latSum: number }>();
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(from);
    d.setUTCDate(from.getUTCDate() + i);
    buckets.set(utcDay(d), { decisions: 0, tokens: 0, cost: 0, latSum: 0 });
  }

  let totalTokens = 0;
  let totalCost = 0;
  let decisionLatencySum = 0;
  let responseCount = 0;
  let metricResponseCount = 0;

  for (const msg of messages) {
    const ranking = (msg.ranking ?? []) as RankedResponse[];
    const meta = (msg.meta ?? {}) as { totalLatencyMs?: number; fromCache?: boolean };
    // A cache hit replays stored token/cost numbers but spent nothing upstream.
    const billable = !meta.fromCache;
    const created = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt as string);

    decisionLatencySum += meta.totalLatencyMs ?? 0;

    const bucket = buckets.get(utcDay(created));
    if (bucket) {
      bucket.decisions += 1;
      bucket.latSum += meta.totalLatencyMs ?? 0;
    }

    for (const r of ranking) {
      responseCount += 1;
      const tokens = billable ? (r.tokens?.total ?? 0) : 0;
      const cost = billable ? (r.costUsd ?? 0) : 0;
      totalTokens += tokens;
      totalCost += cost;

      if (bucket) {
        bucket.tokens += tokens;
        bucket.cost += cost;
      }

      let acc = modelAcc.get(r.model);
      if (!acc) {
        acc = {
          model: r.model,
          label: r.label ?? findModel(r.model)?.label ?? r.model,
          vendor: r.vendor ?? findModel(r.model)?.vendor ?? "Unknown",
          appearances: 0,
          wins: 0,
          scoreSum: 0,
          confidenceSum: 0,
          latencySum: 0,
          tokens: 0,
          costUsd: 0,
          riskSum: 0,
        };
        modelAcc.set(r.model, acc);
      }
      acc.appearances += 1;
      if (r.rank === 1) acc.wins += 1;
      acc.scoreSum += r.score ?? 0;
      acc.confidenceSum += r.confidence ?? 0;
      acc.latencySum += r.latencyMs ?? 0;
      acc.tokens += tokens;
      acc.costUsd += cost;
      acc.riskSum += r.hallucinationRisk ?? 0;

      if (r.metrics) {
        metricResponseCount += 1;
        for (const k of METRIC_KEYS) metricSums[k] += r.metrics[k] ?? 0;
      }
    }
  }

  const models: ModelStat[] = [...modelAcc.values()]
    .map((a) => ({
      model: a.model,
      label: a.label,
      vendor: a.vendor,
      appearances: a.appearances,
      wins: a.wins,
      winRate: round(safeAvg(a.wins, a.appearances), 4),
      avgScore: round(safeAvg(a.scoreSum, a.appearances), 1),
      avgConfidence: round(safeAvg(a.confidenceSum, a.appearances), 1),
      avgLatencyMs: Math.round(safeAvg(a.latencySum, a.appearances)),
      totalTokens: a.tokens,
      totalCostUsd: round(a.costUsd, 6),
      avgHallucinationRisk: round(safeAvg(a.riskSum, a.appearances), 4),
    }))
    .sort((a, b) => b.avgScore - a.avgScore || b.appearances - a.appearances);

  const vendorAcc = new Map<string, VendorStat>();
  for (const m of models) {
    const v = vendorAcc.get(m.vendor) ?? { vendor: m.vendor, appearances: 0, wins: 0, costUsd: 0 };
    v.appearances += m.appearances;
    v.wins += m.wins;
    v.costUsd = round(v.costUsd + m.totalCostUsd, 6);
    vendorAcc.set(m.vendor, v);
  }
  const vendors = [...vendorAcc.values()].sort((a, b) => b.appearances - a.appearances);

  const metricAverages = Object.fromEntries(
    METRIC_KEYS.map((k) => [k, round(safeAvg(metricSums[k], metricResponseCount), 4)]),
  ) as MetricScores;

  const timeseries: TimePoint[] = [...buckets.entries()].map(([date, b]) => ({
    date,
    decisions: b.decisions,
    tokens: b.tokens,
    costUsd: round(b.cost, 6),
    avgLatencyMs: Math.round(safeAvg(b.latSum, b.decisions)),
  }));

  return {
    range: { days: windowDays, from: utcDay(from), to: utcDay(now) },
    totals: {
      decisions: messages.length,
      conversations: conversations.length,
      totalTokens,
      totalCostUsd: round(totalCost, 6),
      avgLatencyMs: Math.round(safeAvg(decisionLatencySum, messages.length)),
      modelsCompared: modelAcc.size,
      responses: responseCount,
    },
    metricAverages,
    models,
    vendors,
    timeseries,
  };
};
