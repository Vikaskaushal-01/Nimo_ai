import { useCallback, useRef, useState } from "react";
import { streamDecision, type StreamDecisionPayload } from "@/lib/stream";
import type { DecisionResult } from "@/types/engine";
import type { DecisionStage } from "@/types/stream";

export interface LiveModel {
  id: string;
  label: string;
  vendor: string;
  content: string;
  status: "streaming" | "done" | "error";
  latencyMs?: number;
  tokens?: number;
  costUsd?: number;
  error?: string;
  rank?: number;
  score?: number;
  confidence?: number;
}

export interface StreamState {
  active: boolean;
  prompt: string;
  stage: DecisionStage | null;
  models: LiveModel[];
  /** Whether a retrieval stage occurred (knowledge base used). */
  usedRag: boolean;
}

const IDLE: StreamState = { active: false, prompt: "", stage: null, models: [], usedRag: false };

/**
 * Drives a streaming decision: exposes live state (per-model token buffers,
 * pipeline stage, ranking overlay) and a `start` action. Calls `onDone` with the
 * final persisted result and `onError` on failure.
 */
export const useDecisionStream = (
  onDone: (result: DecisionResult) => void,
  onError: (message: string) => void,
) => {
  const [state, setState] = useState<StreamState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(IDLE);
  }, []);

  const start = useCallback(
    (payload: StreamDecisionPayload) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({
        active: true,
        prompt: payload.prompt,
        stage: payload.useKnowledgeBase || (payload.documentIds?.length ?? 0) > 0 ? "retrieving" : "querying",
        models: [],
        usedRag: payload.useKnowledgeBase || (payload.documentIds?.length ?? 0) > 0,
      });

      const patchModel = (id: string, patch: Partial<LiveModel>) =>
        setState((s) => ({
          ...s,
          models: s.models.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        }));

      streamDecision(
        payload,
        (event) => {
          switch (event.type) {
            case "start":
              setState((s) => ({
                ...s,
                models: event.models.map((m) => ({ ...m, content: "", status: "streaming" })),
              }));
              break;
            case "token":
              setState((s) => ({
                ...s,
                models: s.models.map((m) =>
                  m.id === event.model ? { ...m, content: m.content + event.delta } : m,
                ),
              }));
              break;
            case "model_done":
              patchModel(event.model, {
                status: "done",
                latencyMs: event.latencyMs,
                tokens: event.tokens,
                costUsd: event.costUsd,
              });
              break;
            case "model_error":
              patchModel(event.model, { status: "error", error: event.error });
              break;
            case "stage":
              setState((s) => ({
                ...s,
                stage: event.stage,
                usedRag: s.usedRag || event.stage === "retrieving",
              }));
              break;
            case "ranked":
              setState((s) => ({
                ...s,
                models: s.models.map((m) => {
                  const r = event.ranking.find((x) => x.model === m.id);
                  return r ? { ...m, rank: r.rank, score: r.score, confidence: r.confidence } : m;
                }),
              }));
              break;
            case "done":
              abortRef.current = null;
              setState(IDLE);
              onDone(event.result);
              break;
            case "error":
              abortRef.current = null;
              setState(IDLE);
              onError(event.message);
              break;
          }
        },
        controller.signal,
      ).catch((err: unknown) => {
        if (controller.signal.aborted) return; // user navigated away; ignore
        abortRef.current = null;
        setState(IDLE);
        onError(err instanceof Error ? err.message : "Stream failed");
      });
    },
    [onDone, onError],
  );

  return { state, start, reset };
};
