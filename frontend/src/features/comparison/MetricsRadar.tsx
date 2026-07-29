import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { METRIC_LABELS, type MetricKey, type MetricScores } from "@/types/engine";

interface MetricsRadarProps {
  metrics: MetricScores;
  color?: string;
}

/** Per-response radar chart across the six weighted metrics. */
export const MetricsRadar = ({ metrics, color = "#7c5cff" }: MetricsRadarProps) => {
  const data = (Object.keys(METRIC_LABELS) as MetricKey[]).map((key) => ({
    metric: METRIC_LABELS[key],
    value: Math.round(metrics[key] * 100),
  }));

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 10 }} />
          <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.35} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
