import { ArrowUp, Library, Loader2 } from "lucide-react";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat.store";
import { useUiStore } from "@/stores/ui.store";
import { ModelSelector } from "./ModelSelector";

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isPending: boolean;
}

/** Prompt composer with model selection and submit-on-Enter. */
export const PromptInput = ({ onSubmit, isPending }: PromptInputProps) => {
  const [value, setValue] = useState("");
  const selectedModels = useChatStore((s) => s.selectedModels);
  const { useKnowledgeBase, setUseKnowledgeBase, selectedDocumentIds } = useChatStore();
  const openKnowledge = useUiStore((s) => s.setKnowledgeOpen);
  const kbActive = useKnowledgeBase || selectedDocumentIds.length > 0;
  const ref = useRef<HTMLTextAreaElement>(null);

  const canSubmit = value.trim().length > 0 && selectedModels.length > 0 && !isPending;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    onSubmit(value.trim());
    setValue("");
    if (ref.current) ref.current.style.height = "auto";
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autoGrow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  };

  return (
    <form onSubmit={submit} className="glass-strong rounded-2xl p-3 shadow-panel">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <ModelSelector />
        <button
          type="button"
          onClick={() => (kbActive ? setUseKnowledgeBase(false) : openKnowledge(true))}
          title="Toggle knowledge base grounding"
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
            kbActive
              ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
              : "border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200",
          )}
        >
          <Library size={12} />
          {kbActive
            ? selectedDocumentIds.length > 0
              ? `KB · ${selectedDocumentIds.length} docs`
              : "KB · all docs"
            : "Knowledge base"}
        </button>
      </div>
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoGrow();
          }}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Ask anything — it will be sent to every selected model…"
          className="max-h-56 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
        <Button type="submit" size="icon" disabled={!canSubmit} aria-label="Send">
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
        </Button>
      </div>
      {selectedModels.length === 0 && (
        <p className="px-2 pt-1 text-[11px] text-amber-400">Select at least one model.</p>
      )}
    </form>
  );
};
