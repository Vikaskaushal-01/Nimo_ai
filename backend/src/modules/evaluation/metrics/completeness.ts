import { saturate, tokenize, clamp01 } from "./text.util.js";

/**
 * Completeness blends coverage (length relative to the longest peer) with
 * structural richness (headings, lists, code) — a thorough answer tends to be
 * substantial AND organized, with diminishing returns so verbosity alone
 * cannot max it out.
 *
 * @param content    the response text
 * @param maxTokens  token count of the longest response in the batch (for relative coverage)
 */
export const completeness = (content: string, maxTokens: number): number => {
  const tokenCount = tokenize(content).length;

  // Relative coverage: how substantial vs. the most substantial peer.
  const coverage = maxTokens > 0 ? clamp01(tokenCount / maxTokens) : 0;

  // Absolute floor so a single long answer still scores reasonably.
  const absolute = saturate(tokenCount, 180);

  // Structural signals.
  const headings = (content.match(/^#{1,6}\s/gm) ?? []).length;
  const bullets = (content.match(/^\s*([-*]|\d+\.)\s/gm) ?? []).length;
  const codeBlocks = (content.match(/```/g) ?? []).length / 2;
  const structure = clamp01(headings * 0.12 + bullets * 0.05 + codeBlocks * 0.15);

  return clamp01(0.5 * coverage + 0.3 * absolute + 0.2 * structure);
};
