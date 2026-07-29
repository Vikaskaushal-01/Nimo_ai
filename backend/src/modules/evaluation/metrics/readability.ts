import { clamp01, sentences, tokenize } from "./text.util.js";

const countSyllables = (word: string): number => {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
};

/**
 * Readability via a normalized Flesch Reading Ease score. Prose-only (code
 * blocks are stripped in `sentences`). Maps the classic 0–100 Flesch scale into
 * [0,1], rewarding clear, well-paced writing over dense walls of text.
 */
export const readability = (content: string): number => {
  const sents = sentences(content);
  const words = tokenize(content);
  if (sents.length === 0 || words.length === 0) return 0.4;

  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const wordsPerSentence = words.length / sents.length;
  const syllablesPerWord = syllables / words.length;

  // Flesch Reading Ease (higher = easier), typically ~0..100.
  const flesch = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;

  return clamp01(flesch / 100);
};
