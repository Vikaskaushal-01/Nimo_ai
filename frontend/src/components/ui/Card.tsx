import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("glass rounded-2xl shadow-panel", className)}
    {...props}
  />
);

export const Badge = ({
  className,
  color,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { color?: string }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-medium",
      className,
    )}
    style={color ? { backgroundColor: `${color}22`, color, borderColor: `${color}55` } : undefined}
    {...props}
  />
);
