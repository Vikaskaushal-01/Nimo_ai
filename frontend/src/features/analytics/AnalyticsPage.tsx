import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  Clock,
  Coins,
  Cpu,
  Layers,
  MessageSquare,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { cn, formatCost, formatMs, formatNumber } from "@/lib/utils";
import { Leaderboard } from "@/features/comparison/Leaderboard";
import type { RankedResponse } from "@/types/engine";
import { DecisionsTimeseries } from "./DecisionsTimeseries";
import { MetricAverages } from "./MetricAverages";
import { ModelPerformanceTable } from "./ModelPerformanceTable";
import { StatCard } from "./StatCard";
import { VendorDistribution } from "./VendorDistribution";

const RANGES = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

/** Full-page usage & quality dashboard aggregated across the user's decisions. */
export const AnalyticsPage = () => {
  const [days, setDays] = useState(30);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["analytics", days],
    queryFn: () => api.getAnalytics(days),
  });

  // Adapt per-model averages into the shape Leaderboard already renders.
  const leaderboard: RankedResponse[] = (data?.models ?? []).map((m, i) => ({
    model: m.model,
    label: m.label,
    vendor: m.vendor,
    content: "",
    latencyMs: m.avgLatencyMs,
    tokens: { prompt: 0, completion: 0, total: m.totalTokens },
    costUsd: m.totalCostUsd,
    metrics: {
      semanticSimilarity: 0,
      completeness: 0,
      accuracy: 0,
      reasoning: 0,
      readability: 0,
      contextPreservation: 0,
    },
    weightedScore: m.avgScore / 100,
    hallucinationRisk: m.avgHallucinationRisk,
    rank: i + 1,
    score: m.avgScore,
    confidence: m.avgConfidence,
  }));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft size={15} /> Chat
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/20 text-accent-soft">
              <BarChart3 size={16} />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">Analytics</div>
              <div className="text-[10px] text-slate-500">Usage &amp; model quality</div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  days === r.days
                    ? "bg-accent text-white"
                    : "text-slate-400 hover:text-slate-200",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {isError ? (
          <Card className="flex items-center gap-2 p-4 text-sm text-red-300">
            <TriangleAlert size={15} />
            {(error as Error)?.message ?? "Failed to load analytics"}
          </Card>
        ) : isLoading || !data ? (
          <LoadingState />
        ) : data.totals.decisions === 0 ? (
          <EmptyState />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                icon={MessageSquare}
                label="Decisions"
                value={formatNumber(data.totals.decisions)}
                hint={`${data.totals.conversations} conversations`}
                accent="#9d86ff"
              />
              <StatCard
                icon={Coins}
                label="Total spend"
                value={formatCost(data.totals.totalCostUsd)}
                hint={`${formatNumber(data.totals.totalTokens)} tokens`}
                accent="#38bdf8"
              />
              <StatCard
                icon={Clock}
                label="Avg latency"
                value={formatMs(data.totals.avgLatencyMs)}
                hint="per decision"
                accent="#fbbf24"
              />
              <StatCard
                icon={Cpu}
                label="Models compared"
                value={formatNumber(data.totals.modelsCompared)}
                hint={`${formatNumber(data.totals.responses)} responses`}
                accent="#34d399"
              />
            </div>

            <DecisionsTimeseries data={data.timeseries} />

            <div className="grid gap-4 lg:grid-cols-2">
              <Leaderboard ranking={leaderboard} />
              <MetricAverages metrics={data.metricAverages} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ModelPerformanceTable models={data.models} />
              </div>
              <VendorDistribution vendors={data.vendors} />
            </div>

            <p className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-500">
              <Layers size={12} /> Aggregated from {data.range.from} to {data.range.to} ·
              last {data.range.days} days
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
};

const LoadingState = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
    <Skeleton className="h-64 w-full" />
    <div className="grid gap-4 lg:grid-cols-2">
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  </div>
);

const EmptyState = () => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex min-h-[55vh] flex-col items-center justify-center text-center"
  >
    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 shadow-glow">
      <BarChart3 size={28} className="text-accent-soft" />
    </div>
    <h1 className="text-2xl font-bold text-white">No analytics yet</h1>
    <p className="mt-2 max-w-sm text-sm text-slate-400">
      Run a few decisions and your usage, spend, and per-model quality trends will show up here.
    </p>
    <Link to="/" className="mt-6">
      <Button variant="primary">
        <MessageSquare size={15} /> Start a decision
      </Button>
    </Link>
  </motion.div>
);
