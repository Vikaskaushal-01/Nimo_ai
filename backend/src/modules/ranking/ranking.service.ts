import type { EvaluatedResponse, RankedResponse } from "../../shared/engine.types.js";

/**
 * Distributes 100 "confidence points" across responses proportionally to their
 * weighted scores using the **largest-remainder (Hamilton) method**, so the
 * integer percentages always sum to EXACTLY 100 — no rounding drift.
 *
 * Exported for unit testing.
 */
export const confidencePercentages = (scores: number[]): number[] => {
  const n = scores.length;
  if (n === 0) return [];
  const total = scores.reduce((a, b) => a + b, 0);

  // Degenerate case: all-zero scores → distribute as evenly as possible.
  if (total <= 0) {
    const base = Math.floor(100 / n);
    const out = new Array<number>(n).fill(base);
    for (let i = 0; i < 100 - base * n; i++) out[i] += 1;
    return out;
  }

  const exact = scores.map((s) => (s / total) * 100);
  const floors = exact.map(Math.floor);
  let remainder = 100 - floors.reduce((a, b) => a + b, 0);

  // Hand out the leftover units to the largest fractional parts.
  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floors];
  for (let i = 0; i < order.length && remainder > 0; i++) {
    result[order[i].index] += 1;
    remainder--;
  }
  return result;
};

/**
 * Ranks evaluated responses by weighted score (desc), assigns ranks and
 * confidence percentages that sum to exactly 100.
 */
export const rankResponses = (evaluated: EvaluatedResponse[]): RankedResponse[] => {
  const sorted = [...evaluated].sort((a, b) => b.weightedScore - a.weightedScore);
  const confidence = confidencePercentages(sorted.map((e) => e.weightedScore));

  return sorted.map((entry, i) => ({
    ...entry,
    rank: i + 1,
    score: Number((entry.weightedScore * 100).toFixed(1)),
    confidence: confidence[i],
  }));
};
