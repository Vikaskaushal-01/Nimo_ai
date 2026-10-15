import type { ChatMessage } from "../modules/ai/provider.types.js";

/**
 * Per-request conversational context shared by orchestration and fusion:
 * earlier turns of the conversation and the user's custom instructions.
 */
export interface PromptContext {
  /** Earlier turns, oldest first, as alternating user/assistant messages. */
  history?: ChatMessage[];
  /** The user's saved custom instructions ("" or undefined when unset). */
  instructions?: string;
}

/** System-prompt suffix carrying the user's custom instructions ("" when unset). */
export const instructionsBlock = (instructions?: string): string => {
  const text = instructions?.trim();
  if (!text) return "";
  return (
    "\n\nThe user has saved these custom instructions. Follow them unless they " +
    `conflict with accuracy or safety:\n"""\n${text}\n"""`
  );
};
