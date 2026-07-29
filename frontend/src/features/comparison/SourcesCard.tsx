import { FileText, Library } from "lucide-react";
import { Badge, Card } from "@/components/ui/Card";
import type { RetrievedSource } from "@/types/engine";

interface SourcesCardProps {
  sources: RetrievedSource[];
}

/** Shows knowledge-base chunks that were retrieved and injected as context. */
export const SourcesCard = ({ sources }: SourcesCardProps) => {
  if (sources.length === 0) return null;
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <Library size={15} className="text-emerald-400" /> Knowledge Base Sources
        <span className="text-xs font-normal text-slate-500">({sources.length})</span>
      </div>
      <div className="space-y-2">
        {sources.map((s, i) => (
          <div key={`${s.documentId}-${s.chunkIndex}`} className="rounded-xl bg-black/20 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/15 text-[10px] font-bold text-emerald-400">
                {i + 1}
              </span>
              <FileText size={12} className="text-slate-500" />
              <span className="truncate font-medium text-slate-300">{s.filename}</span>
              <span className="text-slate-600">#{s.chunkIndex}</span>
              <Badge className="ml-auto bg-emerald-500/10 text-emerald-300">
                {Math.round(s.score * 100)}% match
              </Badge>
            </div>
            <p className="line-clamp-3 text-[11px] leading-relaxed text-slate-500">{s.snippet}</p>
          </div>
        ))}
      </div>
    </Card>
  );
};
