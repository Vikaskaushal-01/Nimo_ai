import { PieChart as PieIcon } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/Card";
import { vendorColor } from "@/lib/utils";
import type { VendorStat } from "@/types/analytics";

interface Props {
  vendors: VendorStat[];
}

/** Share of model responses by vendor family. */
export const VendorDistribution = ({ vendors }: Props) => {
  const data = vendors.map((v) => ({ name: v.vendor, value: v.appearances }));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <PieIcon size={15} className="text-accent-soft" /> Vendor share
      </div>
      {total === 0 ? (
        <p className="py-12 text-center text-xs text-slate-500">No data yet</p>
      ) : (
        <div className="flex items-center gap-3">
          <div className="h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={42}
                  outerRadius={68}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((d) => (
                    <Cell key={d.name} fill={vendorColor(d.name)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#12121a",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`${value} responses`, ""]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5">
            {vendors.map((v) => (
              <li key={v.vendor} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: vendorColor(v.vendor) }}
                />
                <span className="truncate text-slate-300">{v.vendor}</span>
                <span className="ml-auto tabular-nums text-slate-500">
                  {total > 0 ? Math.round((v.appearances / total) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};
