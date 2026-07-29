import { create } from "zustand";

interface UiState {
  knowledgeOpen: boolean;
  setKnowledgeOpen: (open: boolean) => void;
  toggleKnowledge: () => void;
}

/** Ephemeral UI state (drawers, modals) — not persisted. */
export const useUiStore = create<UiState>((set, get) => ({
  knowledgeOpen: false,
  setKnowledgeOpen: (open) => set({ knowledgeOpen: open }),
  toggleKnowledge: () => set({ knowledgeOpen: !get().knowledgeOpen }),
}));
