import { useQuery } from "@tanstack/react-query";
import { Check, Cpu } from "lucide-react";
import { api } from "@/lib/api";
import { cn, vendorColor } from "@/lib/utils";
import { useChatStore } from "@/stores/chat.store";
import { Skeleton } from "@/components/ui/Skeleton";

/** Multi-select chips for choosing which models to query. Config-driven. */
export const ModelSelector = () => {
  const { selectedModels, toggleModel } = useChatStore();
  const { data: models, isLoading } = useQuery({
    queryKey: ["models"],
    queryFn: api.listModels,
  });

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
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <Cpu size={13} /> Models
      </span>
      {models?.filter((m) => m.enabled).map((model) => {
        const active = selectedModels.includes(model.id);
        const color = vendorColor(model.vendor);
        return (
          <button
            key={model.id}
            onClick={() => toggleModel(model.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
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
