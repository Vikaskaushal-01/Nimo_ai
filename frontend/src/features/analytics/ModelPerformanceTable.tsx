import { Crown, Table2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatCost, formatMs, formatNumber, vendorColor } from "@/lib/utils";
import type { ModelStat } from "@/types/analytics";

interface Props {
  models: ModelStat[];
}

const Header = ({ children, align = "right" }: { children: string; align?: "left" | "right" }) => (
  <th
    className={`px-3 py-2 font-medium text-slate-400 ${align === "left" ? "text-left" : "text-right"}`}
  >
    {children}
  </th>
);

/** Per-model rollup: win rate, mean score, latency, tokens, spend, risk. */
export const ModelPerformanceTable = ({ models }: Props) => (
  <Card className="overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-white">
      <Table2 size={15} className="text-accent-soft" /> Model performance
    </div>
    {models.length === 0 ? (
      <p className="px-4 pb-6 text-center text-xs text-slate-500">
        Run a few decisions to populate this table.
      </p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="border-y border-white/10 bg-white/[0.02]">
            <tr>
              <Header align="left">Model</Header>
              <Header>Used</Header>
              <Header>Wins</Header>
              <Header>Win rate</Header>
              <Header>Avg score</Header>
              <Header>Avg latency</Header>
              <Header>Tokens</Header>
              <Header>Spend</Header>
              <Header>Halluc. risk</Header>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.model} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: vendorColor(m.vendor) }}
                    />
                    <span className="font-medium text-slate-100">{m.label}</span>
                    {m.wins > 0 && m.winRate >= 0.5 && (
                      <Crown size={12} className="text-amber-400" />
                    )}
                  </div>
                  <div className="pl-[18px] text-[10px] text-slate-500">{m.vendor}</div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{m.appearances}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{m.wins}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                  {Math.round(m.winRate * 100)}%
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="rounded-md bg-accent/15 px-1.5 py-0.5 font-semibold tabular-nums text-accent-soft">
                    {m.avgScore.toFixed(1)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                  {formatMs(m.avgLatencyMs)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                  {formatNumber(m.totalTokens)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                  {formatCost(m.totalCostUsd)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <span
                    className={
                      m.avgHallucinationRisk > 0.33
                        ? "text-red-300"
                        : m.avgHallucinationRisk > 0.15
                          ? "text-amber-300"
                          : "text-emerald-300"
                    }
                  >
                    {Math.round(m.avgHallucinationRisk * 100)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </Card>
);
