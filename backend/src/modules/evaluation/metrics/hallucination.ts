import { clamp01 } from "./text.util.js";

/**
 * Hallucination risk in [0,1] (higher = riskier). Built from signals that
 * correlate with fabrication:
 *
 *  - Low cross-model agreement (semantic similarity to peers): a claim no other
 *    model makes is likelier invented.
 *  - Low context preservation: drifting off the prompt suggests confabulation.
 *  - Overconfident specificity without corroboration: many precise figures/URLs
 *    while disagreeing with peers.
 *
 * @param semanticSimilarity  this response's agreement-with-peers score [0,1]
 * @param contextScore        this response's context-preservation score [0,1]
 * @param content             the response text (for specificity signals)
 */
export const hallucinationRisk = (
  semanticSimilarity: number,
  contextScore: number,
  content: string,
): number => {
  const disagreement = 1 - semanticSimilarity;
  const offTopic = 1 - contextScore;

  // Specificity: precise numbers, percentages, years, URLs.
  const specifics =
    (content.match(/\b\d{4}\b/g) ?? []).length +
    (content.match(/\d+(\.\d+)?%/g) ?? []).length +
    (content.match(/https?:\/\/\S+/g) ?? []).length;
  // Unsupported specificity only counts as risk when the model also disagrees.
  const unsupportedSpecificity = clamp01(specifics * 0.08) * disagreement;

  const risk = 0.55 * disagreement + 0.25 * offTopic + 0.2 * unsupportedSpecificity;
  return clamp01(risk);
};
