import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}

/** Compact KPI tile used across the top of the analytics dashboard. */
export const StatCard = ({ icon: Icon, label, value, hint, accent = "#9d86ff" }: StatCardProps) => (
  <Card className="p-4">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs font-medium text-slate-400">{label}</div>
        <div className="mt-1 text-2xl font-bold text-white">{value}</div>
        {hint && <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div>}
      </div>
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${accent}22`, color: accent }}
      >
        <Icon size={17} />
      </div>
    </div>
  </Card>
);
