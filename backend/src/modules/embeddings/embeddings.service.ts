import { env } from "../../config/env.js";
import { logger } from "../../shared/logger.js";
import { getProvider } from "../ai/provider.registry.js";
import { tokenize } from "../evaluation/metrics/text.util.js";

/**
 * Shared embedding utility used by both the evaluation engine (semantic
 * similarity) and the RAG retriever. Uses the configured provider's embedding
 * model and falls back to a deterministic lexical (bag-of-words) vector if the
 * provider can't embed — so nothing in the pipeline ever hard-fails on
 * embeddings.
 */
/** Inputs per embedding request — keeps large documents under provider limits. */
const EMBED_BATCH_SIZE = 64;

/**
 * All-or-nothing: either every text gets a provider vector or every text gets a
 * lexical one. Mixing the two would put vectors of different dimensions in the
 * same set, and cosine similarity across them is meaningless.
 */
export const embedTexts = async (texts: string[]): Promise<number[][]> => {
  if (texts.length === 0) return [];
  try {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
      const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
      const { vectors } = await getProvider().embed({ model: env.EMBEDDING_MODEL, input: batch });
      if (vectors.length !== batch.length || vectors.some((v) => !v?.length)) {
        throw new Error("Embedding response shape mismatch");
      }
      out.push(...vectors);
    }
    return out;
  } catch (err) {
    logger.warn("Embeddings unavailable; using lexical fallback", { error: String(err) });
  }
  return texts.map(lexicalVector);
};

/** Embed a single text. */
export const embedOne = async (text: string): Promise<number[]> => {
  const [vec] = await embedTexts([text]);
  return vec ?? lexicalVector(text);
};

/** Deterministic bag-of-words vector — the embedding fallback. */
export const EMBED_DIM = 256;
export const lexicalVector = (text: string): number[] => {
  const vec = new Array<number>(EMBED_DIM).fill(0);
  for (const tok of tokenize(text)) {
    let h = 0x811c9dc5;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    vec[(h >>> 0) % EMBED_DIM] += 1;
  }
  const norm = Math.sqrt(vec.reduce((a, b) => a + b * b, 0)) || 1;
  return vec.map((v) => v / norm);
};
