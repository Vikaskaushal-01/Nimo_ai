import { User } from "lucide-react";
import type { ContributionEntry, DecisionMeta, RankedResponse } from "@/types/engine";
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
export const MessageItem = ({ message }: { message: MessageData }) => (
  <div className="space-y-4">
    <div className="flex justify-end">
      <div className="flex max-w-[85%] items-start gap-2.5">
        <div className="glass rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-slate-100">
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
