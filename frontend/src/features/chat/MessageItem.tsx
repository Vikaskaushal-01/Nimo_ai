import { Check, Copy, CornerDownLeft, Pencil, User } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import type { ContributionEntry, DecisionMeta, Feedback, RankedResponse } from "@/types/engine";
import { useUiStore } from "@/stores/ui.store";
import { AnswerActions } from "./AnswerActions";
import { DecisionResultView } from "./DecisionResultView";

export interface MessageData {
  _id: string;
  conversationId: string;
  prompt: string;
  optimizedAnswer: string;
  reasoningSummary: string;
  contributionMap: ContributionEntry[];
  followUps?: string[];
  feedback?: Feedback;
  ranking: RankedResponse[];
  meta: DecisionMeta;
}

interface MessageItemProps {
  message: MessageData;
  /** The newest message: can be regenerated and shows follow-up suggestions. */
  isLast: boolean;
  /** A request is in flight; editing and regenerating wait for it. */
  busy: boolean;
  /** Replace this message (and everything after it) with an edited prompt. */
  onEdit: (message: MessageData, prompt: string) => void;
  onRegenerate: (message: MessageData) => void;
  onAsk: (prompt: string) => void;
}

const iconBtn =
  "rounded-lg p-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

/** A user prompt followed by its fused, analyzed result. */
export const MessageItem = ({ message, isLast, busy, onEdit, onRegenerate, onAsk }: MessageItemProps) => {
  const setPrefill = useUiStore((s) => s.setPrefill);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.prompt);
  const [copied, setCopied] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    const el = editRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
  }, [editing]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(message.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const cancelEdit = () => {
    setDraft(message.prompt);
    setEditing(false);
  };

  const saveEdit = () => {
    const next = draft.trim();
    if (!next || busy) return;
    setEditing(false);
    onEdit(message, next);
  };

  const onEditKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      cancelEdit();
    }
  };

  return (
    <div className="space-y-4">
      <div className="group flex justify-end">
        <div className={editing ? "flex w-full max-w-[85%] items-start gap-2.5" : "flex max-w-[85%] items-start gap-2.5"}>
          {editing ? (
            <div className="glass-strong flex-1 rounded-2xl p-3">
              <textarea
                ref={editRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 300)}px`;
                }}
                onKeyDown={onEditKey}
                maxLength={20_000}
                aria-label="Edit your message"
                className="w-full resize-none bg-transparent text-sm text-slate-100 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Sending replaces this answer and everything after it.
              </p>
              <div className="mt-2 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={!draft.trim() || busy}>
                  Send
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-1.5 flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                <button onClick={copyPrompt} className={iconBtn} title="Copy" aria-label="Copy message">
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
                <button
                  onClick={() => setEditing(true)}
                  disabled={busy}
                  className={iconBtn}
                  title="Edit and resend"
                  aria-label="Edit message"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => setPrefill(message.prompt)}
                  className={iconBtn}
                  title="Reuse this prompt"
                  aria-label="Reuse this prompt"
                >
                  <CornerDownLeft size={13} />
                </button>
              </div>
              <div className="glass whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-slate-100">
                {message.prompt}
              </div>
            </>
          )}
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
            <User size={14} className="text-slate-300" />
          </div>
        </div>
      </div>
      <DecisionResultView
        {...message}
        actions={
          <AnswerActions
            conversationId={message.conversationId}
            messageId={message._id}
            answer={message.optimizedAnswer}
            feedback={message.feedback}
            followUps={message.followUps}
            isLast={isLast}
            busy={busy}
            onRegenerate={() => onRegenerate(message)}
            onAsk={onAsk}
          />
        }
      />
    </div>
  );
};
