import { CornerDownLeft, User } from "lucide-react";
import type { ContributionEntry, DecisionMeta, RankedResponse } from "@/types/engine";
import { useUiStore } from "@/stores/ui.store";
import { DecisionResultView } from "./DecisionResultView";

export interface MessageData {
  prompt: string;
  optimizedAnswer: string;
  reasoningSummary: string;
  contributionMap: ContributionEntry[];
  ranking: RankedResponse[];
  meta: DecisionMeta;
}

/** A user prompt followed by its fused, analyzed result. */
export const MessageItem = ({ message }: { message: MessageData }) => {
  const setPrefill = useUiStore((s) => s.setPrefill);
  return (
    <div className="space-y-4">
      <div className="group flex justify-end">
        <div className="flex max-w-[85%] items-start gap-2.5">
          <button
            onClick={() => setPrefill(message.prompt)}
            className="mt-1.5 shrink-0 rounded-lg p-1 text-slate-500 opacity-100 transition-opacity hover:bg-white/10 hover:text-white md:opacity-0 md:group-hover:opacity-100"
            title="Reuse this prompt"
            aria-label="Reuse this prompt"
          >
            <CornerDownLeft size={13} />
          </button>
          <div className="glass whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-slate-100">
            {message.prompt}
          </div>
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
            <User size={14} className="text-slate-300" />
          </div>
        </div>
      </div>
      <DecisionResultView {...message} />
    </div>
  );
};
