import { EVALUATION_WEIGHTS, type MetricKey } from "../../config/providers.js";
import type {
  EvaluatedResponse,
  MetricScores,
  NormalizedResponse,
} from "../../shared/engine.types.js";
import { embedTexts } from "../embeddings/embeddings.service.js";
import { accuracy } from "./metrics/accuracy.js";
import { completeness } from "./metrics/completeness.js";
import { contextPreservation } from "./metrics/contextPreservation.js";
import { hallucinationRisk } from "./metrics/hallucination.js";
import { readability } from "./metrics/readability.js";
import { reasoning } from "./metrics/reasoning.js";
import { semanticSimilarity } from "./metrics/semanticSimilarity.js";
import { clamp01, tokenize } from "./metrics/text.util.js";

/** Weighted aggregate of per-metric scores using the configured weights. */
export const weightedScore = (metrics: MetricScores): number => {
  let total = 0;
  for (const key of Object.keys(EVALUATION_WEIGHTS) as MetricKey[]) {
    total += metrics[key] * EVALUATION_WEIGHTS[key];
  }
  return clamp01(total);
};

/**
 * Evaluates every response independently across the weighted metric suite.
 * Obtains embeddings from the active provider for semantic similarity; if the
 * provider can't embed, falls back to a deterministic lexical vector so the
 * pipeline never hard-fails.
 */
export const evaluateResponses = async (
  prompt: string,
  responses: NormalizedResponse[],
): Promise<EvaluatedResponse[]> => {
  if (responses.length === 0) return [];

  const contents = responses.map((r) => r.content);
  const vectors = await embedTexts(contents);
  const maxTokens = Math.max(...responses.map((r) => tokenize(r.content).length), 1);

  return responses.map((response, i) => {
    const sem = semanticSimilarity(i, vectors);
    const ctx = contextPreservation(prompt, response.content);

    const metrics: MetricScores = {
      semanticSimilarity: sem,
      completeness: completeness(response.content, maxTokens),
      accuracy: accuracy(i, contents),
      reasoning: reasoning(response.content),
      readability: readability(response.content),
      contextPreservation: ctx,
    };

    return {
      ...response,
      metrics,
      weightedScore: weightedScore(metrics),
      hallucinationRisk: hallucinationRisk(sem, ctx, response.content),
    };
  });
};
