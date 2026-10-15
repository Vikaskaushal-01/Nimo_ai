import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlus, RefreshCw, Square, ThumbsDown, ThumbsUp, Volume2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useReadAloud } from "@/lib/speech";
import { cn } from "@/lib/utils";
import { toast } from "@/stores/toast.store";
import type { Feedback, StoredMessage } from "@/types/engine";

interface AnswerActionsProps {
  conversationId: string;
  messageId: string;
  answer: string;
  feedback?: Feedback;
  followUps?: string[];
  /** Only the latest answer can be regenerated and shows follow-up suggestions. */
  isLast: boolean;
  /** A request is running; regenerate and follow-ups wait for it. */
  busy: boolean;
  onRegenerate: () => void;
  onAsk: (prompt: string) => void;
}

/** Read aloud, thumbs up/down, regenerate, and suggested follow-up questions. */
export const AnswerActions = ({
  conversationId,
  messageId,
  answer,
  feedback = null,
  followUps = [],
  isLast,
  busy,
  onRegenerate,
  onAsk,
}: AnswerActionsProps) => {
  const qc = useQueryClient();
  const [current, setCurrent] = useState<Feedback>(feedback);
  const voice = useReadAloud(answer);

  const rate = useMutation({
    mutationFn: (next: Feedback) => api.setFeedback(conversationId, messageId, next),
    onMutate: (next) => {
      const previous = current;
      setCurrent(next);
      return previous;
    },
    onSuccess: ({ feedback: saved }) => {
      qc.setQueryData<StoredMessage[]>(["messages", conversationId], (old) =>
        old?.map((m) => (m._id === messageId ? { ...m, feedback: saved } : m)),
      );
      if (saved) toast("Thanks for the feedback");
    },
    onError: (e: Error, _next, previous) => {
      setCurrent(previous ?? null);
      toast(e.message, "error");
    },
  });

  const toggle = (value: "up" | "down") => rate.mutate(current === value ? null : value);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-0.5">
        {voice.supported && (
          <ActionButton
            label={voice.speaking ? "Stop reading" : "Read aloud"}
            onClick={voice.speaking ? voice.stop : voice.speak}
          >
            {voice.speaking ? <Square size={13} className="fill-current" /> : <Volume2 size={14} />}
          </ActionButton>
        )}
        <ActionButton label="Good answer" active={current === "up"} onClick={() => toggle("up")}>
          <ThumbsUp size={14} className={cn(current === "up" && "fill-current")} />
        </ActionButton>
        <ActionButton label="Bad answer" active={current === "down"} onClick={() => toggle("down")}>
          <ThumbsDown size={14} className={cn(current === "down" && "fill-current")} />
        </ActionButton>
        {isLast && (
          <ActionButton label="Regenerate answer" onClick={onRegenerate} disabled={busy}>
            <RefreshCw size={14} />
            <span className="text-xs">Regenerate</span>
          </ActionButton>
        )}
      </div>

      {isLast && followUps.length > 0 && (
        <div className="flex flex-col items-start gap-1.5">
          {followUps.map((q) => (
            <button
              key={q}
              onClick={() => onAsk(q)}
              disabled={busy}
              className="glass flex items-center gap-2 rounded-xl px-3 py-1.5 text-left text-xs text-slate-300 transition-colors hover:border-accent/40 hover:text-white disabled:opacity-50"
            >
              <MessageSquarePlus size={13} className="shrink-0 text-accent-soft" />
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ActionButton = ({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    aria-pressed={active}
    className={cn(
      "flex items-center gap-1 rounded-lg px-2 py-1.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40",
      active && "text-accent-soft",
    )}
  >
    {children}
  </button>
);
