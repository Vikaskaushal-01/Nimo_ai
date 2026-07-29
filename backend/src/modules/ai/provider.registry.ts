import { useMockProvider } from "../../config/env.js";
import { logger } from "../../shared/logger.js";
import { MockProvider } from "./mock.provider.js";
import { OpenRouterProvider } from "./openrouter.provider.js";
import type { IProvider } from "./provider.types.js";

/**
 * Resolves the active provider. Today this is a single provider selected by
 * configuration; the registry is the seam where native per-vendor providers
 * (OpenAI, Anthropic, Ollama, …) get registered and routed later — without any
 * caller changes, since everything depends on IProvider.
 */
let instance: IProvider | null = null;

export const getProvider = (): IProvider => {
  if (instance) return instance;
  instance = useMockProvider ? new MockProvider() : new OpenRouterProvider();
  logger.info("AI provider initialized", { provider: instance.name });
  return instance;
};
