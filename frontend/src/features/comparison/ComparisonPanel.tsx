import { motion } from "framer-motion";
import { Layers } from "lucide-react";
import { ModelCard } from "./ModelCard";
import type { RankedResponse } from "@/types/engine";

interface ComparisonPanelProps {
  ranking: RankedResponse[];
}

/** Stacked, expandable comparison cards for every model. */
export const ComparisonPanel = ({ ranking }: ComparisonPanelProps) => {
  if (ranking.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
        <Layers size={15} className="text-accent-soft" /> Model Comparison
      </div>
      <div className="space-y-2">
        {ranking.map((response, i) => (
          <motion.div
            key={response.model}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <ModelCard response={response} />
          </motion.div>
        ))}
      </div>
    </div>
  );
};
