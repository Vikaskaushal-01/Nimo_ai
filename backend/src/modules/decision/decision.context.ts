import type { RetrievedSource } from "../../shared/engine.types.js";
import { buildContextBlock, retrieve } from "../rag/rag.service.js";

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
