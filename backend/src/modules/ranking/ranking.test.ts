import { describe, expect, it } from "vitest";
import { confidencePercentages, rankResponses } from "./ranking.service.js";
import type { EvaluatedResponse, MetricScores } from "../../shared/engine.types.js";

const sumsTo100 = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("confidencePercentages (largest-remainder)", () => {
  it("always sums to exactly 100", () => {
    const cases = [
      [0.9, 0.8, 0.7],
      [0.333, 0.333, 0.333],
      [0.1, 0.2, 0.3, 0.4],
      [0.95, 0.04, 0.01],
      [1],
      [0.5, 0.5],
      [0.123, 0.456, 0.789, 0.012, 0.345],
    ];
    for (const c of cases) {
      expect(sumsTo100(confidencePercentages(c))).toBe(100);
    }
  });

  it("handles all-zero scores by distributing evenly", () => {
    const out = confidencePercentages([0, 0, 0]);
    expect(sumsTo100(out)).toBe(100);
    // 100 / 3 → 34,33,33
    expect(out).toEqual([34, 33, 33]);
  });

  it("returns empty for empty input", () => {
    expect(confidencePercentages([])).toEqual([]);
  });

  it("gives the larger share to the higher score", () => {
    const [a, b] = confidencePercentages([0.8, 0.2]);
    expect(a).toBeGreaterThan(b);
    expect(a + b).toBe(100);
  });

  it("assigns 100 to a single response", () => {
    expect(confidencePercentages([0.42])).toEqual([100]);
  });
});

describe("rankResponses", () => {
  const mkMetrics = (v: number): MetricScores => ({
    semanticSimilarity: v,
    completeness: v,
    accuracy: v,
    reasoning: v,
    readability: v,
    contextPreservation: v,
  });

  const mk = (model: string, score: number): EvaluatedResponse => ({
    model,
    label: model,
    vendor: "test",
    content: "x",
    latencyMs: 100,
    tokens: { prompt: 1, completion: 1, total: 2 },
    costUsd: 0,
    metrics: mkMetrics(score),
    weightedScore: score,
    hallucinationRisk: 0,
  });

  it("orders by weighted score descending and assigns ranks", () => {
    const ranked = rankResponses([mk("a", 0.5), mk("b", 0.9), mk("c", 0.7)]);
    expect(ranked.map((r) => r.model)).toEqual(["b", "c", "a"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("produces confidences summing to 100 and 0-100 scores", () => {
    const ranked = rankResponses([mk("a", 0.5), mk("b", 0.9), mk("c", 0.7)]);
    expect(sumsTo100(ranked.map((r) => r.confidence))).toBe(100);
    for (const r of ranked) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  it("handles an empty set", () => {
    expect(rankResponses([])).toEqual([]);
  });
});
