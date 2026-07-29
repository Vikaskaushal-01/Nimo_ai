import axios, { type AxiosInstance } from "axios";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/AppError.js";
import type {
  ChatRequest,
  ChatResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  IProvider,
  OnDelta,
} from "./provider.types.js";

/**
 * OpenRouter-backed provider. One API key reaches every model in the catalog.
 * Speaks the OpenAI-compatible Chat Completions + Embeddings schema that
 * OpenRouter exposes.
 */
export class OpenRouterProvider implements IProvider {
  public readonly name = "openrouter";
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: env.OPENROUTER_BASE_URL,
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        // OpenRouter attribution headers (optional but recommended).
        "HTTP-Referer": env.OPENROUTER_APP_URL,
        "X-Title": env.OPENROUTER_APP_TITLE,
      },
    });
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    try {
      const { data } = await this.http.post(
        "/chat/completions",
        {
          model: req.model,
          messages: req.messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens,
          ...(req.json ? { response_format: { type: "json_object" } } : {}),
        },
        { signal: req.signal, timeout: env.AI_REQUEST_TIMEOUT_MS },
      );

      const choice = data?.choices?.[0];
      const content: string = choice?.message?.content ?? "";
      const usage = data?.usage ?? {};

      return {
        model: req.model,
        content,
        usage: {
          promptTokens: usage.prompt_tokens ?? 0,
          completionTokens: usage.completion_tokens ?? 0,
          totalTokens:
            usage.total_tokens ??
            (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
        },
      };
    } catch (err) {
      throw this.wrap(err, req.model);
    }
  }

  async chatStream(req: ChatRequest, onDelta: OnDelta): Promise<ChatResponse> {
    try {
      const response = await this.http.post(
        "/chat/completions",
        {
          model: req.model,
          messages: req.messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens,
          stream: true,
          // Ask OpenRouter to include token usage in the terminal chunk.
          stream_options: { include_usage: true },
        },
        { signal: req.signal, timeout: env.AI_REQUEST_TIMEOUT_MS, responseType: "stream" },
      );

      const stream = response.data as NodeJS.ReadableStream;
      let buffer = "";
      let content = "";
      let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } = {};

      for await (const chunk of stream) {
        buffer += chunk.toString();
        // SSE frames are separated by newlines; process complete lines only.
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const delta: string = json?.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              content += delta;
              onDelta(delta);
            }
            if (json?.usage) usage = json.usage;
          } catch {
            /* ignore keep-alive comments / partial frames */
          }
        }
      }

      const promptTokens = usage.prompt_tokens ?? 0;
      const completionTokens = usage.completion_tokens ?? estimateTokens(content);
      return {
        model: req.model,
        content,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: usage.total_tokens ?? promptTokens + completionTokens,
        },
      };
    } catch (err) {
      throw this.wrap(err, req.model);
    }
  }

  async embed(req: EmbeddingRequest): Promise<EmbeddingResponse> {
    try {
      const { data } = await this.http.post(
        "/embeddings",
        { model: req.model, input: req.input },
        { signal: req.signal, timeout: env.AI_REQUEST_TIMEOUT_MS },
      );
      const vectors: number[][] = (data?.data ?? [])
        .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
        .map((d: { embedding: number[] }) => d.embedding);
      return { model: req.model, vectors };
    } catch (err) {
      throw this.wrap(err, req.model);
    }
  }

  private wrap(err: unknown, model: string): AppError {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const apiMessage =
        (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message ??
        err.message;
      return AppError.upstream(`OpenRouter [${model}] failed: ${apiMessage}`, { status });
    }
    return AppError.upstream(`OpenRouter [${model}] failed`, { error: String(err) });
  }
}

/** Rough token estimate (~4 chars/token) when a provider omits usage. */
const estimateTokens = (text: string): number => Math.ceil(text.length / 4);
