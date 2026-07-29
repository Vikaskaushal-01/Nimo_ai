import { create } from "zustand";
import { persist } from "zustand/middleware";

const DEFAULT_MODELS = [
  "openai/gpt-4o-mini",
  "anthropic/claude-3.5-sonnet",
  "google/gemini-flash-1.5",
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

  setConversation: (id: string | null) => void;
  setSelectedModels: (models: string[]) => void;
  toggleModel: (id: string) => void;
  setUseKnowledgeBase: (on: boolean) => void;
  toggleDocument: (id: string) => void;
  newChat: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversationId: null,
      selectedModels: DEFAULT_MODELS,
      useKnowledgeBase: false,
      selectedDocumentIds: [],

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
      newChat: () => set({ conversationId: null }),
    }),
    {
      name: "mai-chat",
      partialize: (s) => ({
        selectedModels: s.selectedModels,
        useKnowledgeBase: s.useKnowledgeBase,
      }),
    },
  ),
);
