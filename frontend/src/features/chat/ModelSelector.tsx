import { useQuery } from "@tanstack/react-query";
import { Check, Cpu } from "lucide-react";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { cn, vendorColor } from "@/lib/utils";
import { useChatStore } from "@/stores/chat.store";
import type { ModelInfo } from "@/types/engine";
import { Skeleton } from "@/components/ui/Skeleton";

/** One-click model sets. Ids missing from the server's catalog are skipped. */
const PRESETS: { label: string; hint: string; models: string[] }[] = [
  {
    label: "Fast",
    hint: "Quickest free models",
    models: ["liquid/lfm-2.5-2.6b:free", "nvidia/nemotron-3.5-lightning:free", "nvidia/nemotron-3-super-120b-a12b:free"],
  },
  {
    label: "Balanced",
    hint: "Strong free models from different vendors",
    models: ["nvidia/nemotron-3-ultra-550b-a55b:free", "google/gemma-4-31b-it:free", "dots-studio/dots-3-note-preview:free"],
  },
  {
    label: "Best",
    hint: "Strongest free models — slower",
    models: ["nvidia/nemotron-3-ultra-550b-a55b:free", "nvidia/nemotron-3-super-120b-a12b:free", "google/gemma-4-31b-it:free", "dots-studio/dots-3-note-preview:free"],
  },
];

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

const priceHint = (m: ModelInfo): string =>
  `${m.vendor} · ${(m.pricing.promptPer1k * 1000).toFixed(2)} in / ${(m.pricing.completionPer1k * 1000).toFixed(2)} out per 1M tokens · ${Math.round(m.contextWindow / 1000)}K context`;

/** Multi-select chips for choosing which models to query. Config-driven. */
export const ModelSelector = () => {
  const { selectedModels, toggleModel, pruneModels, setSelectedModels } = useChatStore();
  const { data: models, isLoading } = useQuery({
    queryKey: ["models"],
    queryFn: api.listModels,
    staleTime: 5 * 60_000,
  });

  // Selections persist in localStorage; drop any the server no longer offers so
  // a retired model can't make every request fail validation.
  useEffect(() => {
    if (models) pruneModels(models.filter((m) => m.enabled).map((m) => m.id));
  }, [models, pruneModels]);

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="no-scrollbar -mx-1 flex min-w-0 max-w-full items-center gap-2 overflow-x-auto px-1 sm:flex-wrap">
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-400">
        <Cpu size={13} /> Models
      </span>
      {PRESETS.map((preset) => {
        const available = new Set(models?.filter((m) => m.enabled).map((m) => m.id));
        const ids = preset.models.filter((id) => available.has(id));
        if (ids.length === 0) return null;
        const active = sameSet(ids, selectedModels);
        return (
          <button
            key={preset.label}
            type="button"
            onClick={() => setSelectedModels(ids)}
            title={`${preset.hint}: ${ids.length} models`}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
              active ? "bg-accent/25 text-accent-soft" : "text-slate-500 hover:bg-white/5 hover:text-slate-200",
            )}
          >
            {preset.label}
          </button>
        );
      })}
      <span className="h-4 w-px shrink-0 bg-white/10" aria-hidden />
      {models?.filter((m) => m.enabled).map((model) => {
        const active = selectedModels.includes(model.id);
        const color = vendorColor(model.vendor);
        return (
          <button
            key={model.id}
            type="button"
            onClick={() => toggleModel(model.id)}
            title={priceHint(model)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-all",
              active
                ? "border-transparent text-white"
                : "border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200",
            )}
            style={active ? { backgroundColor: `${color}33`, borderColor: `${color}88` } : undefined}
          >
            {active && <Check size={12} style={{ color }} />}
            {model.label}
          </button>
        );
      })}
    </div>
  );
};
