import { Trophy } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { vendorColor } from "@/lib/utils";
import type { RankedResponse } from "@/types/engine";

interface LeaderboardProps {
  ranking: RankedResponse[];
}

/** Score leaderboard with a horizontal bar chart. */
export const Leaderboard = ({ ranking }: LeaderboardProps) => {
  const data = ranking.map((r) => ({ name: r.label, score: r.score, vendor: r.vendor }));

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <Trophy size={15} className="text-amber-400" /> Model Leaderboard
      </div>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fill: "#cbd5e1", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                background: "#12121a",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                fontSize: 12,
              }}
            />
            <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={18}>
              {data.map((d, i) => (
                <Cell key={i} fill={vendorColor(d.vendor)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
