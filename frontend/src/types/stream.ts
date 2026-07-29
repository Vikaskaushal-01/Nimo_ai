// Mirrors backend/src/modules/decision/decision.stream.service.ts

import type { DecisionResult, RankedResponse } from "./engine";

export type DecisionStage =
  | "retrieving"
  | "querying"
  | "evaluating"
  | "ranking"
  | "fusing"
  | "saving";

export type DecisionStreamEvent =
  | { type: "start"; models: { id: string; label: string; vendor: string }[] }
  | { type: "token"; model: string; delta: string }
  | { type: "model_done"; model: string; latencyMs: number; tokens: number; costUsd: number }
  | { type: "model_error"; model: string; label: string; error: string }
  | { type: "stage"; stage: DecisionStage }
  | { type: "ranked"; ranking: RankedResponse[] }
  | { type: "done"; result: DecisionResult }
  | { type: "error"; message: string };

export const STAGE_ORDER: DecisionStage[] = [
  "retrieving",
  "querying",
  "evaluating",
  "ranking",
  "fusing",
  "saving",
];

export const STAGE_LABEL: Record<DecisionStage, string> = {
  retrieving: "Retrieving context",
  querying: "Querying models",
  evaluating: "Evaluating quality",
  ranking: "Ranking & confidence",
  fusing: "Fusing optimized answer",
  saving: "Saving",
};
