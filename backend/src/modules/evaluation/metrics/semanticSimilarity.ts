import { cosine } from "./text.util.js";

/**
 * Semantic similarity = how strongly a response agrees with the *consensus* of
 * the others (mean pairwise cosine over embedding vectors). Central responses
 * that align with the group score higher; outliers score lower.
 *
 * @param index   index of the response being scored
 * @param vectors embedding vector per response, same order
 * @returns score in [0,1]
 */
export const semanticSimilarity = (index: number, vectors: number[][]): number => {
  if (vectors.length <= 1) return 1; // a lone response trivially "agrees"
  const self = vectors[index];
  let sum = 0;
  let count = 0;
  for (let i = 0; i < vectors.length; i++) {
    if (i === index) continue;
    sum += cosine(self, vectors[i]);
    count++;
  }
  return count === 0 ? 0 : sum / count;
};
