import { GitMerge } from "lucide-react";
import { Badge, Card } from "@/components/ui/Card";
import type { ContributionEntry } from "@/types/engine";

interface ContributionMapProps {
  entries: ContributionEntry[];
}

/** Shows which models contributed to each section of the fused answer. */
export const ContributionMap = ({ entries }: ContributionMapProps) => {
  if (entries.length === 0) return null;
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <GitMerge size={15} className="text-accent-soft" /> AI Contribution Mapping
      </div>
      <div className="space-y-2">
        {entries.map((entry, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <span className="w-40 shrink-0 text-xs font-medium text-slate-300">{entry.section}</span>
            <div className="flex flex-wrap gap-1.5">
              {entry.models.map((m, j) => (
                <Badge key={j} className="bg-accent/15 text-accent-soft">
                  {m}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
