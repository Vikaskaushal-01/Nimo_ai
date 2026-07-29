/**
 * Pure text utilities shared by the evaluation metrics. No I/O, no randomness —
 * fully deterministic and unit-testable.
 */

export const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export const tokenize = (text: string): string[] =>
  text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

export const sentences = (text: string): string[] =>
  text
    .replace(/```[\s\S]*?```/g, " ") // drop code blocks from prose stats
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

export const uniqueRatio = (tokens: string[]): number => {
  if (tokens.length === 0) return 0;
  return new Set(tokens).size / tokens.length;
};

/** Cosine similarity between two equal-length numeric vectors. */
export const cosine = (a: number[], b: number[]): number => {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : clamp01(dot / denom);
};

/** Jaccard overlap of token sets — lexical fallback similarity. */
export const jaccard = (a: string, b: string): number => {
  const sa = new Set(tokenize(a));
  const sb = new Set(tokenize(b));
  if (sa.size === 0 && sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
};

/**
 * Map a value to [0,1] with a smooth saturating curve. `mid` is the input that
 * maps to ~0.5. Useful for "more is better, with diminishing returns" signals.
 */
export const saturate = (value: number, mid: number): number => {
  if (value <= 0) return 0;
  return clamp01(value / (value + mid));
};
