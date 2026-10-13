import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AnswerStyle } from "@/types/engine";

const DEFAULT_MODELS = [
  "openai/gpt-4o-mini",
  "anthropic/claude-sonnet-5.5",
  "google/gemini-3.8-flash",
];

interface ChatState {
  /** Currently open conversation (null = unsaved new chat). */
  conversationId: string | null;
  /** Model ids selected for the next decision request. */
  selectedModels: string[];
  /** Whether to ground the next request in the knowledge base (RAG). */
  useKnowledgeBase: boolean;
  /** Document ids to restrict RAG to (empty = all of the user's docs). */
  selectedDocumentIds: string[];
  /** Answer length/depth for the next request. */
  answerStyle: AnswerStyle;
  setAnswerStyle: (style: AnswerStyle) => void;

  setConversation: (id: string | null) => void;
  setSelectedModels: (models: string[]) => void;
  toggleModel: (id: string) => void;
  setUseKnowledgeBase: (on: boolean) => void;
  toggleDocument: (id: string) => void;
  /** Turn knowledge-base grounding fully off (global flag + document scope). */
  disableKnowledgeBase: () => void;
  removeDocument: (id: string) => void;
  /** Drop selected models that the server no longer offers (e.g. retired). */
  pruneModels: (available: string[]) => void;
  newChat: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversationId: null,
      selectedModels: DEFAULT_MODELS,
      useKnowledgeBase: false,
      selectedDocumentIds: [],
      answerStyle: "balanced",
      setAnswerStyle: (answerStyle) => set({ answerStyle }),

      setConversation: (id) => set({ conversationId: id }),
      setSelectedModels: (models) => set({ selectedModels: models }),
      toggleModel: (id) => {
        const current = get().selectedModels;
        set({
          selectedModels: current.includes(id)
            ? current.filter((m) => m !== id)
            : [...current, id],
        });
      },
      setUseKnowledgeBase: (on) => set({ useKnowledgeBase: on }),
      toggleDocument: (id) => {
        const current = get().selectedDocumentIds;
        set({
          selectedDocumentIds: current.includes(id)
            ? current.filter((d) => d !== id)
            : [...current, id],
        });
      },
      disableKnowledgeBase: () => set({ useKnowledgeBase: false, selectedDocumentIds: [] }),
      removeDocument: (id) =>
        set({ selectedDocumentIds: get().selectedDocumentIds.filter((d) => d !== id) }),
      pruneModels: (available) => {
        const current = get().selectedModels;
        const valid = current.filter((m) => available.includes(m));
        if (valid.length === current.length) return;
        // Keep at least one model selected when everything saved went stale.
        const fallback = DEFAULT_MODELS.filter((m) => available.includes(m));
        set({ selectedModels: valid.length > 0 ? valid : fallback.length > 0 ? fallback : available.slice(0, 3) });
      },
      newChat: () => set({ conversationId: null }),
    }),
    {
      name: "mai-chat",
      partialize: (s) => ({
        selectedModels: s.selectedModels,
        useKnowledgeBase: s.useKnowledgeBase,
        answerStyle: s.answerStyle,
      }),
    },
  ),
);
