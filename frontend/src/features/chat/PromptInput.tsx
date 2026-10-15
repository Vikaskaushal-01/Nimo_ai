import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Library, Loader2, Mic, Paperclip, Square } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useDictation } from "@/lib/speech";
import { cn } from "@/lib/utils";
import { toast } from "@/stores/toast.store";
import { useChatStore } from "@/stores/chat.store";
import { useUiStore } from "@/stores/ui.store";
import type { AnswerStyle } from "@/types/engine";
import { ModelSelector } from "./ModelSelector";

const STYLES: { value: AnswerStyle; label: string; hint: string }[] = [
  { value: "concise", label: "Concise", hint: "Short, direct answers" },
  { value: "balanced", label: "Balanced", hint: "Default depth" },
  { value: "detailed", label: "Detailed", hint: "In-depth answers with examples" },
];

/** Mirrors the backend prompt limit. */
const MAX_PROMPT_CHARS = 20_000;

/** File types the knowledge base can parse (kept in sync with KnowledgeDrawer). */
const ATTACH_ACCEPT =
  ".txt,.md,.markdown,.csv,.json,.pdf,.docx,.js,.ts,.tsx,.py,.java,.go,.rs,.sql,.yaml,.yml,.html,.css";

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  /** Cancels the in-flight decision. */
  onStop: () => void;
  isPending: boolean;
}

/** Prompt composer with model selection and submit-on-Enter. */
export const PromptInput = ({ onSubmit, onStop, isPending }: PromptInputProps) => {
  const [value, setValue] = useState("");
  const selectedModels = useChatStore((s) => s.selectedModels);
  const {
    useKnowledgeBase,
    disableKnowledgeBase,
    selectedDocumentIds,
    toggleDocument,
    answerStyle,
    setAnswerStyle,
  } = useChatStore();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  // 📎 Attach: index the file into the knowledge base and scope this chat to it.
  const attach = useMutation({
    mutationFn: (file: File) => api.uploadDocument(file),
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      if (doc.status === "failed") {
        toast(`${doc.filename}: ${doc.error || "couldn't read this file"}`, "error");
        return;
      }
      if (!useChatStore.getState().selectedDocumentIds.includes(doc.id)) toggleDocument(doc.id);
      toast(`Attached ${doc.filename} — answers will use it`);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (file) attach.mutate(file);
  };

  // 🎤 Dictation appends each recognized phrase to the prompt.
  const dictation = useDictation(
    (text) => {
      setValue((v) => (v && !v.endsWith(" ") ? `${v} ${text}` : `${v}${text}`));
      requestAnimationFrame(autoGrow);
    },
    (message) => toast(message, "error"),
  );
  const openKnowledge = useUiStore((s) => s.setKnowledgeOpen);
  const kbActive = useKnowledgeBase || selectedDocumentIds.length > 0;
  const ref = useRef<HTMLTextAreaElement>(null);
  const prefill = useUiStore((s) => s.prefill);

  // Load text requested elsewhere (example prompts, "reuse prompt").
  useEffect(() => {
    if (!prefill) return;
    setValue(prefill.text);
    requestAnimationFrame(() => {
      autoGrow();
      ref.current?.focus();
    });
  }, [prefill]);

  const canSubmit = value.trim().length > 0 && selectedModels.length > 0 && !isPending;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    if (dictation.listening) dictation.stop();
    onSubmit(value.trim());
    setValue("");
    if (ref.current) ref.current.style.height = "auto";
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't send while an IME is still composing a character.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
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
      <div className="mb-2.5 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <ModelSelector />
        <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          // Turning off must also clear the document scope, or the chip stays on.
          onClick={() => (kbActive ? disableKnowledgeBase() : openKnowledge(true))}
          title="Toggle knowledge base grounding"
          className={cn(
            "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-all",
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
        <div
          className="flex shrink-0 items-center rounded-full border border-white/10 p-0.5"
          role="radiogroup"
          aria-label="Answer style"
        >
          {STYLES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={answerStyle === s.value}
              title={s.hint}
              onClick={() => setAnswerStyle(s.value)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                answerStyle === s.value ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-200",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        </div>
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
          maxLength={MAX_PROMPT_CHARS}
          placeholder={
            dictation.listening ? "Listening… speak now" : "Ask anything — it will be sent to every selected model…"
          }
          className="max-h-56 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
        <input ref={fileRef} type="file" accept={ATTACH_ACCEPT} onChange={onFile} className="hidden" />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => fileRef.current?.click()}
          disabled={attach.isPending}
          aria-label="Attach a file"
          title="Attach a file (PDF, Word, text, code…)"
        >
          {attach.isPending ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
        </Button>
        {dictation.supported && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={dictation.listening ? dictation.stop : dictation.start}
            aria-label={dictation.listening ? "Stop voice input" : "Voice input"}
            aria-pressed={dictation.listening}
            title={dictation.listening ? "Stop voice input" : "Voice input"}
            className={cn(dictation.listening && "animate-pulse bg-red-500/15 text-red-300 hover:bg-red-500/20")}
          >
            <Mic size={16} />
          </Button>
        )}
        {isPending ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={onStop}
            aria-label="Stop generating"
            title="Stop generating"
          >
            <Square size={13} className="fill-current" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!canSubmit} aria-label="Send" title="Send (Enter)">
            <ArrowUp size={16} />
          </Button>
        )}
      </div>
      <div className="flex items-center justify-between px-2 pt-1 text-[11px]">
        {selectedModels.length === 0 ? (
          <span className="text-amber-400">Select at least one model.</span>
        ) : (
          <span className="hidden text-slate-600 sm:inline">
            Enter to send · Shift+Enter for a new line
          </span>
        )}
        {value.length > MAX_PROMPT_CHARS * 0.8 && (
          <span className={cn("ml-auto tabular-nums", value.length >= MAX_PROMPT_CHARS ? "text-red-400" : "text-slate-500")}>
            {value.length.toLocaleString()} / {MAX_PROMPT_CHARS.toLocaleString()}
          </span>
        )}
      </div>
    </form>
  );
};
