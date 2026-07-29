import { cosine } from "../evaluation/metrics/text.util.js";

export interface Scored<T> {
  item: T;
  score: number;
}

/**
 * Ranks items by cosine similarity of their `embedding` to `queryVector`,
 * returning the top `k` (descending). Pure + deterministic → unit-tested.
 */
export const rankByCosine = <T extends { embedding: number[] }>(
  queryVector: number[],
  items: T[],
  k: number,
): Scored<T>[] =>
  items
    .map((item) => ({ item, score: cosine(queryVector, item.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, k));
