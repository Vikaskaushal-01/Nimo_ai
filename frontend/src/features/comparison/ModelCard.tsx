import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ChevronDown, Clock, Coins, Hash } from "lucide-react";
import { useState } from "react";
import { Badge, Card } from "@/components/ui/Card";
import { Markdown } from "@/components/ui/Markdown";
import { cn, formatCost, formatMs, formatNumber, vendorColor } from "@/lib/utils";
import { METRIC_LABELS, type MetricKey, type RankedResponse } from "@/types/engine";
import { ConfidenceMeter } from "./ConfidenceMeter";
import { MetricsRadar } from "./MetricsRadar";

interface ModelCardProps {
  response: RankedResponse;
}

/** Expandable per-model comparison card. */
export const ModelCard = ({ response }: ModelCardProps) => {
  const [open, setOpen] = useState(false);
  const color = vendorColor(response.vendor);
  const risk = Math.round(response.hallucinationRisk * 100);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
          style={{ backgroundColor: `${color}22`, color }}
        >
          #{response.rank}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-white">{response.label}</span>
            <Badge color={color}>{response.vendor}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><Clock size={11} /> {formatMs(response.latencyMs)}</span>
            <span className="flex items-center gap-1"><Hash size={11} /> {formatNumber(response.tokens.total)} tok</span>
            <span className="flex items-center gap-1"><Coins size={11} /> {formatCost(response.costUsd)}</span>
            <span className={cn("flex items-center gap-1", risk > 50 && "text-amber-400")}>
              <AlertTriangle size={11} /> {risk}% risk
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ConfidenceMeter value={response.confidence} color={color} size={48} />
          <ChevronDown
            size={16}
            className={cn("text-slate-500 transition-transform", open && "rotate-180")}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Quality breakdown
                </h4>
                <MetricsRadar metrics={response.metrics} color={color} />
                <div className="mt-2 space-y-1.5">
                  {(Object.keys(METRIC_LABELS) as MetricKey[]).map((key) => (
                    <MetricBar key={key} label={METRIC_LABELS[key]} value={response.metrics[key]} color={color} />
                  ))}
                </div>
              </div>
              <div className="min-w-0">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Raw response
                </h4>
                <div className="max-h-72 overflow-y-auto rounded-xl bg-black/20 p-3">
                  <Markdown content={response.content} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

const MetricBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="flex items-center gap-2 text-[11px]">
    <span className="w-24 shrink-0 text-slate-400">{label}</span>
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(value * 100)}%` }}
        transition={{ duration: 0.6 }}
      />
    </div>
    <span className="w-8 text-right tabular-nums text-slate-300">{Math.round(value * 100)}</span>
  </div>
);
