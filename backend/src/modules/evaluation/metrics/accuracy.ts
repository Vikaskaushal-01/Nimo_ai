import { jaccard } from "./text.util.js";

/**
 * Accuracy / factual consistency is approximated by *cross-model agreement*:
 * facts that multiple independent models state are far more likely correct than
 * facts only one model asserts. We measure lexical claim overlap (Jaccard) with
 * every peer and take the mean. This complements the embedding-based semantic
 * similarity metric by operating on surface tokens (named entities, numbers,
 * terms), which is where factual claims live.
 *
 * @param index    index of the response being scored
 * @param contents all response texts, same order
 */
export const accuracy = (index: number, contents: string[]): number => {
  if (contents.length <= 1) return 0.7; // no corroboration possible; neutral-positive prior
  let sum = 0;
  let count = 0;
  for (let i = 0; i < contents.length; i++) {
    if (i === index) continue;
    sum += jaccard(contents[index], contents[i]);
    count++;
  }
  const agreement = count === 0 ? 0 : sum / count;
  // Jaccard runs low even for strong agreement (different phrasing), so rescale.
  return Math.min(1, agreement * 2.2);
};
