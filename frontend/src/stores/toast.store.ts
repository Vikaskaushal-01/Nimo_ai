import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  dismiss: (id: number) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

let nextId = 1;

/** Shows a short-lived notification. Callable from anywhere (not just components). */
export const toast = (message: string, kind: ToastKind = "success"): void => {
  const id = nextId++;
  // Cap the stack so rapid actions can't flood the screen.
  useToastStore.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, message }] }));
  setTimeout(() => useToastStore.getState().dismiss(id), kind === "error" ? 5000 : 2500);
};
