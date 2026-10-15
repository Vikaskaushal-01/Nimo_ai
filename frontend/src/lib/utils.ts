import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export const formatMs = (ms: number): string =>
  ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;

export const formatCost = (usd: number): string => {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  return `$${usd.toFixed(4)}`;
};

export const formatNumber = (n: number): string => new Intl.NumberFormat().format(n);

export const pct = (v: number): string => `${Math.round(v * 100)}%`;

/** Stable accent color per vendor for badges/charts. */
export const vendorColor = (vendor: string): string => {
  const map: Record<string, string> = {
    OpenAI: "#10a37f",
    Anthropic: "#d4915d",
    Google: "#4285f4",
    DeepSeek: "#7c5cff",
    Meta: "#0668e1",
    Qwen: "#a855f7",
    Mistral: "#ff7000",
    NVIDIA: "#76b900",
    Liquid: "#06b6d4",
  };
  return map[vendor] ?? "#9d86ff";
};
