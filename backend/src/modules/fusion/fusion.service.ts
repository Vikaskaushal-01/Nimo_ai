import { z } from "zod";
import { env } from "../../config/env.js";
import { styleInstruction, type AnswerStyle } from "../../shared/answerStyle.js";
import { logger } from "../../shared/logger.js";
import type { FusionResult, RankedResponse } from "../../shared/engine.types.js";
import { getProvider } from "../ai/provider.registry.js";
import type { ChatMessage } from "../ai/provider.types.js";

const FusionSchema = z.object({
  optimizedAnswer: z.string().min(1),
  reasoningSummary: z.string().default(""),
  contributionMap: z
    .array(
      z.object({
        section: z.string(),
        models: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

/**
 * Synthesizes ONE optimized answer from all model responses. This is the core
 * "never just pick one" rule: an LLM is instructed to merge the strongest
 * reasoning, remove duplication, resolve conflicts, and attribute each section
 * to its contributing models. Output is strict JSON, validated; on any failure
 * we fall back to the top-ranked answer so the pipeline always returns.
 */
export const fuseResponses = async (
  prompt: string,
  ranked: RankedResponse[],
  style?: AnswerStyle,
): Promise<FusionResult> => {
  if (ranked.length === 0) {
    return {
      optimizedAnswer: "No model produced a usable response.",
      reasoningSummary: "All providers failed or returned empty output.",
      contributionMap: [],
    };
  }

  if (ranked.length === 1) {
    return {
      optimizedAnswer: ranked[0].content,
      reasoningSummary: `Only ${ranked[0].label} responded, so its answer is returned unchanged.`,
      contributionMap: [{ section: "Full answer", models: [ranked[0].label] }],
    };
  }

  const messages = buildMessages(prompt, ranked, style);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await getProvider().chat({
        model: env.FUSION_MODEL,
        messages,
        temperature: 0.3,
        // Retry without strict JSON mode: some models reject `response_format`,
        // and extractJson() tolerates fenced / prose-wrapped JSON anyway.
        json: attempt === 1,
      });
      const parsed = FusionSchema.parse(JSON.parse(extractJson(res.content)));
      return parsed;
    } catch (err) {
      logger.warn("Fusion attempt failed", { attempt, error: String(err) });
    }
  }

  // Fallback: return the best single answer with a minimal contribution map.
  logger.warn("Fusion failed after retries; falling back to top-ranked answer");
  return {
    optimizedAnswer: ranked[0].content,
    reasoningSummary: `Automated fusion was unavailable; returning the highest-scoring response (${ranked[0].label}, score ${ranked[0].score}).`,
    contributionMap: [{ section: "Full answer", models: [ranked[0].label] }],
  };
};

const buildMessages = (
  prompt: string,
  ranked: RankedResponse[],
  style?: AnswerStyle,
): ChatMessage[] => {
  const responsesBlock = ranked
    .map(
      (r, i) =>
        `### Response ${i + 1} — ${r.label} (score ${r.score}/100, confidence ${r.confidence}%, hallucination risk ${(
          r.hallucinationRisk * 100
        ).toFixed(0)}%)\n${r.content}`,
    )
    .join("\n\n---\n\n");

  const modelLabels = ranked.map((r) => r.label).join(", ");

  return [
    {
      role: "system",
      content:
        "You are a meticulous answer-synthesis engine. You receive multiple AI " +
        "responses to the same prompt, each pre-scored for quality. Your job is to " +
        "produce ONE optimized answer that is strictly better than any single input: " +
        "merge the strongest reasoning, keep the most accurate and technically deep " +
        "content, remove duplication, resolve any conflicts in favour of higher-scoring " +
        "and corroborated responses, and improve structure and readability. " +
        "Attribute each major section to the models that contributed to it. " +
        "Respond ONLY with a JSON object of shape: " +
        '{"optimizedAnswer": string (markdown), "reasoningSummary": string, ' +
        '"contributionMap": [{"section": string, "models": string[]}]}. ' +
        `Use these exact model names where relevant: ${modelLabels}.` +
        styleInstruction(style),
    },
    {
      role: "user",
      content: `Original prompt:\n"""${prompt}"""\n\nCandidate responses:\n\n${responsesBlock}\n\nReturn the JSON now.`,
    },
  ];
};

/** Tolerates models that wrap JSON in prose or code fences. */
const extractJson = (text: string): string => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
};
