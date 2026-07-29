import { clamp01, sentences, tokenize } from "./text.util.js";

/** Connectives that signal explicit reasoning / logical structure. */
const REASONING_MARKERS = [
  "because",
  "therefore",
  "thus",
  "hence",
  "since",
  "however",
  "although",
  "consequently",
  "as a result",
  "for example",
  "for instance",
  "in contrast",
  "on the other hand",
  "first",
  "second",
  "finally",
  "in conclusion",
  "this means",
  "which implies",
];

/**
 * Reasoning quality estimates how much explicit logical scaffolding a response
 * contains: density of reasoning connectives plus multi-step structure
 * (enumerations / several sentences), normalized by length so long rambles do
 * not win automatically.
 */
export const reasoning = (content: string): number => {
  const lower = content.toLowerCase();
  const tokenCount = tokenize(content).length || 1;

  let markerHits = 0;
  for (const marker of REASONING_MARKERS) {
    const matches = lower.split(marker).length - 1;
    markerHits += matches;
  }
  // Markers per ~100 tokens, saturating around a healthy density.
  const density = clamp01((markerHits / tokenCount) * 100 * 0.15);

  const stepCount = (content.match(/^\s*\d+\.\s/gm) ?? []).length;
  const steps = clamp01(stepCount * 0.12);

  const sentenceCount = sentences(content).length;
  const elaboration = clamp01(sentenceCount / 12);

  return clamp01(0.55 * density + 0.2 * steps + 0.25 * elaboration);
};
