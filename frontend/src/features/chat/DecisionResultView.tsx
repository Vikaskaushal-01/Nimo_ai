import { motion } from "framer-motion";
import { Check, Copy, Database, Sparkles, Timer, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Badge, Card } from "@/components/ui/Card";
import { Markdown } from "@/components/ui/Markdown";
import { formatMs, vendorColor } from "@/lib/utils";
import type { ContributionEntry, DecisionMeta, RankedResponse } from "@/types/engine";
import { ComparisonPanel } from "../comparison/ComparisonPanel";
import { ContributionMap } from "../comparison/ContributionMap";
import { Leaderboard } from "../comparison/Leaderboard";
import { SourcesCard } from "../comparison/SourcesCard";

interface DecisionResultViewProps {
  optimizedAnswer: string;
  reasoningSummary: string;
  contributionMap: ContributionEntry[];
  ranking: RankedResponse[];
  meta: DecisionMeta;
}

/** Renders one fused assistant result: optimized answer + full analytics. */
export const DecisionResultView = ({
  optimizedAnswer,
  reasoningSummary,
  contributionMap,
  ranking,
  meta,
}: DecisionResultViewProps) => {
  const [copied, setCopied] = useState(false);
  const best = ranking[0];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(optimizedAnswer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (insecure origin or permission denied) */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Optimized fused answer */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-accent/15 to-transparent px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles size={15} className="text-accent-soft" /> Optimized Answer
          </div>
          <div className="flex items-center gap-2">
            {best && (
              <Badge color={vendorColor(best.vendor)}>Best: {best.label}</Badge>
            )}
            <button
              onClick={copy}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="px-4 py-3">
          <Markdown content={optimizedAnswer} />
        </div>

        {reasoningSummary && (
          <div className="border-t border-white/10 bg-black/20 px-4 py-2.5 text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Reasoning: </span>
            {reasoningSummary}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-4 py-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Timer size={11} /> {formatMs(meta.totalLatencyMs)}
          </span>
          <span>{ranking.length} models fused</span>
          {meta.fromCache && (
            <span className="flex items-center gap-1 text-sky-400">
              <Database size={11} /> cached
            </span>
          )}
          <span className="text-slate-500">via {meta.provider}</span>
          {meta.failedModels.length > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <TriangleAlert size={11} /> {meta.failedModels.length} failed
            </span>
          )}
        </div>
      </Card>

      {/* Analytics */}
      {ranking.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Leaderboard ranking={ranking} />
          <ContributionMap entries={contributionMap} />
        </div>
      )}

      {meta.sources && meta.sources.length > 0 && <SourcesCard sources={meta.sources} />}

      <ComparisonPanel ranking={ranking} />
    </motion.div>
  );
};
