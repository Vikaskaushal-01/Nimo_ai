import { Gauge } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { MetricsRadar } from "@/features/comparison/MetricsRadar";
import { METRIC_LABELS, type MetricKey, type MetricScores } from "@/types/engine";

interface Props {
  metrics: MetricScores;
}

/** Average evaluation profile across every response in the range. */
export const MetricAverages = ({ metrics }: Props) => {
  const keys = Object.keys(METRIC_LABELS) as MetricKey[];
  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
        <Gauge size={15} className="text-accent-soft" /> Average quality profile
      </div>
      <MetricsRadar metrics={metrics} color="#9d86ff" />
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        {keys.map((k) => (
          <div key={k} className="flex items-center justify-between">
            <span className="text-slate-400">{METRIC_LABELS[k]}</span>
            <span className="tabular-nums text-slate-200">{Math.round(metrics[k] * 100)}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
};
