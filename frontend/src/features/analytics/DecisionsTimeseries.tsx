import { Activity } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { formatCost } from "@/lib/utils";
import type { TimePoint } from "@/types/analytics";

interface Props {
  data: TimePoint[];
}

const tooltipStyle = {
  background: "#12121a",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  fontSize: 12,
} as const;

/** Short MM-DD tick from a YYYY-MM-DD date string. */
const dayTick = (d: string): string => d.slice(5);

/** Stacked activity view: decisions per day plus daily spend overlay. */
export const DecisionsTimeseries = ({ data }: Props) => (
  <Card className="p-4">
    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
      <Activity size={15} className="text-accent-soft" /> Activity over time
    </div>
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -16, right: 8, top: 4 }}>
          <defs>
            <linearGradient id="gradDecisions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#7c5cff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={dayTick}
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            yAxisId="left"
            allowDecimals={false}
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <YAxis yAxisId="right" orientation="right" hide />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string) =>
              name === "Spend" ? formatCost(value) : value
            }
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="decisions"
            name="Decisions"
            stroke="#9d86ff"
            strokeWidth={2}
            fill="url(#gradDecisions)"
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="costUsd"
            name="Spend"
            stroke="#38bdf8"
            strokeWidth={1.5}
            fill="url(#gradCost)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </Card>
);
