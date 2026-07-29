import { apiBaseUrl, refreshAccessToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type { DecisionStreamEvent } from "@/types/stream";

export interface StreamDecisionPayload {
  prompt: string;
  models: string[];
  conversationId?: string;
  useKnowledgeBase?: boolean;
  documentIds?: string[];
}

/**
 * POSTs to the SSE decision endpoint and invokes `onEvent` for each parsed
 * event. Uses fetch (not EventSource) so it can send the Bearer token + JSON
 * body, and transparently retries once after refreshing an expired token.
 * Pass an AbortSignal to cancel an in-flight stream.
 */
export const streamDecision = async (
  payload: StreamDecisionPayload,
  onEvent: (event: DecisionStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> => {
  const run = async (token: string | null, allowRetry: boolean): Promise<void> => {
    const res = await fetch(`${apiBaseUrl}/decision/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (res.status === 401 && allowRetry) {
      const fresh = await refreshAccessToken();
      if (fresh) return run(fresh, false);
    }

    if (!res.ok || !res.body) {
      const message = await safeError(res);
      throw new Error(message);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // Read until the stream ends, parsing SSE frames separated by blank lines.
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const line of frame.split("\n")) {
          const trimmed = line.trimStart();
          if (!trimmed.startsWith("data:")) continue; // skip ": ping" heartbeats
          const data = trimmed.slice(5).trim();
          if (!data) continue;
          try {
            onEvent(JSON.parse(data) as DecisionStreamEvent);
          } catch {
            /* ignore malformed frame */
          }
        }
      }
    }
  };

  await run(useAuthStore.getState().accessToken, true);
};

const safeError = async (res: Response): Promise<string> => {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
};
