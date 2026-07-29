/**
 * Provider abstraction. Every AI backend (OpenRouter today; native OpenAI /
 * Anthropic / Ollama tomorrow) implements `IProvider`. The rest of the
 * application depends ONLY on this interface — never on a concrete provider.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  /** Model slug from the catalog (config/providers.ts). */
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider to return strict JSON when supported. */
  json?: boolean;
  /** Abort signal for timeouts. */
  signal?: AbortSignal;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResponse {
  model: string;
  content: string;
  usage: TokenUsage;
}

export interface EmbeddingRequest {
  model: string;
  input: string[];
  signal?: AbortSignal;
}

export interface EmbeddingResponse {
  model: string;
  /** One vector per input string, in order. */
  vectors: number[][];
}

/** Invoked with each incremental text chunk during streaming. */
export type OnDelta = (delta: string) => void;

export interface IProvider {
  /** Stable identifier, e.g. "openrouter" | "mock". */
  readonly name: string;

  /** Single completion. Implementations must throw on transport/HTTP errors. */
  chat(req: ChatRequest): Promise<ChatResponse>;

  /**
   * Streaming completion. Calls `onDelta` for each token chunk and resolves
   * with the fully assembled response (content + usage) when complete.
   */
  chatStream(req: ChatRequest, onDelta: OnDelta): Promise<ChatResponse>;

  /**
   * Batch embeddings. Implementations that cannot embed should throw; callers
   * are expected to fall back to a lexical similarity heuristic.
   */
  embed(req: EmbeddingRequest): Promise<EmbeddingResponse>;
}
