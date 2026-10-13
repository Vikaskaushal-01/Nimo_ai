import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToastStore, type ToastKind } from "@/stores/toast.store";

const ICON: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
};

const COLOR: Record<ToastKind, string> = {
  success: "text-emerald-400",
  error: "text-red-400",
  info: "text-sky-400",
};

/** Bottom-center stack of notifications raised via `toast()`. */
export const Toaster = () => {
  const { toasts, dismiss } = useToastStore();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="glass-strong pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl px-3.5 py-2 text-xs text-slate-100 shadow-panel"
              role={t.kind === "error" ? "alert" : "status"}
            >
              <Icon size={14} className={cn("shrink-0", COLOR[t.kind])} />
              <span className="min-w-0 flex-1">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-slate-500 hover:text-white"
                aria-label="Dismiss"
              >
                <X size={12} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
