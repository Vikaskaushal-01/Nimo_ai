import type { RetrievedSource } from "../../shared/engine.types.js";
import type { ChatMessage } from "../ai/provider.types.js";
import { User } from "../auth/user.model.js";
import { Message } from "../chat/message.model.js";
import { buildContextBlock, retrieve } from "../rag/rag.service.js";

/** Earlier turns sent with each request — enough for follow-ups, bounded for cost. */
const HISTORY_TURNS = 6;
/** Per-message cap so one long answer can't crowd out the rest of the context. */
const HISTORY_CHARS = 4_000;

const clip = (text: string): string =>
  text.length <= HISTORY_CHARS ? text : `${text.slice(0, HISTORY_CHARS)}…`;

/**
 * The most recent turns of a conversation as alternating user/assistant
 * messages (oldest first), so models can answer follow-up questions.
 * Callers must have verified ownership of the conversation.
 */
export const loadHistory = async (conversationId?: string): Promise<ChatMessage[]> => {
  if (!conversationId) return [];
  const recent = await Message.find({ conversationId })
    .sort({ createdAt: -1 })
    .limit(HISTORY_TURNS)
    .select("prompt optimizedAnswer")
    .lean();
  return recent.reverse().flatMap((m) => [
    { role: "user" as const, content: clip(m.prompt) },
    { role: "assistant" as const, content: clip(m.optimizedAnswer ?? "") },
  ]);
};

/** The user's saved custom instructions ("" when unset). */
export const loadInstructions = async (ownerId: string): Promise<string> => {
  const user = await User.findById(ownerId).select("customInstructions").lean();
  return user?.customInstructions?.trim() ?? "";
};

export interface ContextInput {
  ownerId: string;
  prompt: string;
  useKnowledgeBase?: boolean;
  documentIds?: string[];
}

export interface ResolvedContext {
  /** Prompt actually sent to the models (original, or context-augmented). */
  augmentedPrompt: string;
  /** Sources injected as context (empty when RAG is off or nothing matched). */
  sources: RetrievedSource[];
}

/**
 * If the knowledge base is enabled for this request, retrieve relevant chunks
 * and prepend them as grounding context. The original prompt is preserved for
 * display; only what's sent to the models changes.
 */
export const resolveContext = async (input: ContextInput): Promise<ResolvedContext> => {
  const enabled = input.useKnowledgeBase || (input.documentIds?.length ?? 0) > 0;
  if (!enabled) return { augmentedPrompt: input.prompt, sources: [] };

  const sources = await retrieve(input.ownerId, input.prompt, {
    documentIds: input.documentIds,
    topK: 5,
  });
  if (sources.length === 0) return { augmentedPrompt: input.prompt, sources: [] };

  const context = buildContextBlock(sources);
  return {
    augmentedPrompt: `${context}\n\nUser question:\n${input.prompt}`,
    sources,
  };
};
