import { create } from "zustand";

interface UiState {
  knowledgeOpen: boolean;
  setKnowledgeOpen: (open: boolean) => void;
  toggleKnowledge: () => void;

  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;

  /** Conversation sidebar visibility on small screens (always shown on md+). */
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  /**
   * Text to load into the prompt box (example prompts, "reuse prompt").
   * `nonce` changes on every request so the same text can be loaded twice.
   */
  prefill: { text: string; nonce: number } | null;
  setPrefill: (text: string) => void;
}

/** Ephemeral UI state (drawers, modals) — not persisted. */
export const useUiStore = create<UiState>((set, get) => ({
  knowledgeOpen: false,
  setKnowledgeOpen: (open) => set({ knowledgeOpen: open }),
  toggleKnowledge: () => set({ knowledgeOpen: !get().knowledgeOpen }),

  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),

  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  prefill: null,
  setPrefill: (text) => set({ prefill: { text, nonce: Date.now() } }),
}));
