/** How long / deep answers should be. Chosen per request in the UI. */
export const ANSWER_STYLES = ["balanced", "concise", "detailed"] as const;
export type AnswerStyle = (typeof ANSWER_STYLES)[number];

const INSTRUCTIONS: Record<AnswerStyle, string> = {
  balanced: "",
  concise:
    " Keep the answer short and to the point: lead with the direct answer and include only essential details.",
  detailed:
    " Give a thorough, in-depth answer: cover the reasoning, edge cases and trade-offs, with examples where useful.",
};

/** Extra system-prompt guidance for a style ("" for the default). */
export const styleInstruction = (style: AnswerStyle = "balanced"): string => INSTRUCTIONS[style];
