import { motion } from "framer-motion";
import { AlertTriangle, Check, Clock, Coins, Hash, Loader2, User } from "lucide-react";
import { Badge, Card } from "@/components/ui/Card";
import { cn, formatCost, formatMs, formatNumber, vendorColor } from "@/lib/utils";
import { STAGE_LABEL, STAGE_ORDER, type DecisionStage } from "@/types/stream";
import type { LiveModel, StreamState } from "./useDecisionStream";

/** Live view while a streaming decision runs: stage stepper + per-model cards. */
export const StreamingDecision = ({ state }: { state: StreamState }) => (
  <div className="space-y-4">
    <div className="flex justify-end">
      <div className="flex max-w-[85%] items-start gap-2.5">
        <div className="glass whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-slate-100">
          {state.prompt}
        </div>
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
          <User size={14} className="text-slate-300" />
        </div>
      </div>
    </div>

    <StageStepper stage={state.stage} usedRag={state.usedRag} />

    <div className="space-y-2">
      {state.models.map((m) => (
        <LiveCard key={m.id} model={m} />
      ))}
    </div>
  </div>
);

const StageStepper = ({ stage, usedRag }: { stage: DecisionStage | null; usedRag: boolean }) => {
  const order = usedRag ? STAGE_ORDER : STAGE_ORDER.filter((s) => s !== "retrieving");
  const current = stage ? order.indexOf(stage) : 0;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[11px]">
      {order.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div
            key={s}
            className={cn(
              "flex items-center gap-1.5",
              done && "text-emerald-400",
              active && "text-accent-soft",
              !done && !active && "text-slate-600",
            )}
          >
            {done ? (
              <Check size={12} />
            ) : active ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
            )}
            {STAGE_LABEL[s]}
          </div>
        );
      })}
    </div>
  );
};

const LiveCard = ({ model }: { model: LiveModel }) => {
  const color = vendorColor(model.vendor);
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
          {model.rank ? (
            <span
              className="flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold"
              style={{ backgroundColor: `${color}22`, color }}
            >
              #{model.rank}
            </span>
          ) : null}
          <span className="font-medium text-white">{model.label}</span>
          <Badge color={color}>{model.vendor}</Badge>

          <div className="ml-auto flex items-center gap-3 text-[11px] text-slate-400">
            {model.score != null && (
              <span className="font-semibold text-white">{model.score}/100</span>
            )}
            {model.confidence != null && <span style={{ color }}>{model.confidence}%</span>}
            <StatusIcon model={model} />
          </div>
        </div>

        <div className="px-4 py-3">
          {model.status === "error" ? (
            <p className="flex items-center gap-1.5 text-xs text-amber-400">
              <AlertTriangle size={13} /> {model.error}
            </p>
          ) : (
            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-300">
              {model.content}
              {model.status === "streaming" && (
                <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-accent align-middle" />
              )}
            </p>
          )}
        </div>

        {model.status === "done" && (
          <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-4 py-1.5 text-[11px] text-slate-500">
            {model.latencyMs != null && (
              <span className="flex items-center gap-1"><Clock size={11} /> {formatMs(model.latencyMs)}</span>
            )}
            {model.tokens != null && (
              <span className="flex items-center gap-1"><Hash size={11} /> {formatNumber(model.tokens)} tok</span>
            )}
            {model.costUsd != null && (
              <span className="flex items-center gap-1"><Coins size={11} /> {formatCost(model.costUsd)}</span>
            )}
          </div>
        )}
      </Card>
    </motion.div>
  );
};

const StatusIcon = ({ model }: { model: LiveModel }) => {
  if (model.status === "streaming") return <Loader2 size={13} className="animate-spin text-accent-soft" />;
  if (model.status === "done") return <Check size={13} className="text-emerald-400" />;
  return <AlertTriangle size={13} className="text-amber-400" />;
};
