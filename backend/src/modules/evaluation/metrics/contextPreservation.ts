import { clamp01, tokenize } from "./text.util.js";

// Very common words that carry little topical signal.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "be", "been", "as", "at", "by", "it", "this",
  "that", "these", "those", "i", "you", "we", "they", "he", "she", "do", "does",
  "how", "what", "why", "when", "which", "can", "could", "should", "would",
  "please", "explain", "describe", "tell", "me", "about", "your",
]);

/**
 * Context preservation = does the answer actually address the prompt? Measures
 * recall of the prompt's salient (non-stopword) terms within the response.
 *
 * @param promptText  the user prompt
 * @param content     the response text
 */
export const contextPreservation = (promptText: string, content: string): number => {
  const promptTerms = new Set(tokenize(promptText).filter((t) => !STOPWORDS.has(t) && t.length > 2));
  if (promptTerms.size === 0) return 0.8; // nothing salient to preserve

  const answerTerms = new Set(tokenize(content));
  let hit = 0;
  for (const term of promptTerms) if (answerTerms.has(term)) hit++;

  return clamp01(hit / promptTerms.size);
};
