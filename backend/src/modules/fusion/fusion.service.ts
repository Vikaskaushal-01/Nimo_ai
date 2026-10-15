import { z } from "zod";
import { env } from "../../config/env.js";
import { styleInstruction, type AnswerStyle } from "../../shared/answerStyle.js";
import { instructionsBlock, type PromptContext } from "../../shared/promptContext.js";
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
  followUps: z
    .array(z.string())
    .default([])
    // Small models sometimes pad or over-deliver; keep a few short, non-empty ones.
    .transform((qs) => qs.map((q) => q.trim()).filter((q) => q.length > 0 && q.length <= 200).slice(0, 3)),
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
  context: PromptContext = {},
): Promise<FusionResult> => {
  if (ranked.length === 0) {
    return {
      optimizedAnswer: "No model produced a usable response.",
      reasoningSummary: "All providers failed or returned empty output.",
      contributionMap: [],
      followUps: [],
    };
  }

  if (ranked.length === 1) {
    return {
      optimizedAnswer: ranked[0].content,
      reasoningSummary: `Only ${ranked[0].label} responded, so its answer is returned unchanged.`,
      contributionMap: [{ section: "Full answer", models: [ranked[0].label] }],
      followUps: [],
    };
  }

  const messages = buildMessages(prompt, ranked, style, context);

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
    followUps: [],
  };
};

const buildMessages = (
  prompt: string,
  ranked: RankedResponse[],
  style?: AnswerStyle,
  { history = [], instructions }: PromptContext = {},
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
        '"contributionMap": [{"section": string, "models": string[]}], ' +
        '"followUps": string[] (exactly 3 short, natural follow-up questions the user ' +
        "might ask next, written from the user's point of view)}. " +
        `Use these exact model names where relevant: ${modelLabels}.` +
        styleInstruction(style) +
        instructionsBlock(instructions),
    },
    {
      role: "user",
      content: `${historyBlock(history)}Original prompt:\n"""${prompt}"""\n\nCandidate responses:\n\n${responsesBlock}\n\nReturn the JSON now.`,
    },
  ];
};

/** Earlier turns, so follow-ups like "make it shorter" are fused in context. */
const historyBlock = (history: ChatMessage[]): string => {
  if (history.length === 0) return "";
  const turns = history
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${clip(m.content, 1_500)}`)
    .join("\n\n");
  return `Conversation so far (for context only):\n"""\n${turns}\n"""\n\n`;
};

const clip = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max)}…`;

/** Tolerates models that wrap JSON in prose or code fences. */
const extractJson = (text: string): string => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
};
