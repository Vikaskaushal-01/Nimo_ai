import { describe, expect, it } from "vitest";
import { decisionCacheKey, isRagRequest, type DecisionInput } from "./decision.service.js";

const base: DecisionInput = {
  prompt: "Explain CAP theorem",
  models: ["openai/gpt-4o-mini", "openai/gpt-4o"],
  ownerId: "user-a",
};

describe("decisionCacheKey", () => {
  it("is stable regardless of model order", () => {
    const a = decisionCacheKey(base);
    const b = decisionCacheKey({ ...base, models: [...base.models].reverse() });
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it("differs by prompt and by model set", () => {
    const k = decisionCacheKey(base);
    expect(decisionCacheKey({ ...base, prompt: "Explain ACID" })).not.toBe(k);
    expect(decisionCacheKey({ ...base, models: ["openai/gpt-4o"] })).not.toBe(k);
  });

  it("separates answer styles, treating no style as balanced", () => {
    const k = decisionCacheKey(base);
    expect(decisionCacheKey({ ...base, style: "balanced" })).toBe(k);
    expect(decisionCacheKey({ ...base, style: "concise" })).not.toBe(k);
    expect(decisionCacheKey({ ...base, style: "detailed" })).not.toBe(
      decisionCacheKey({ ...base, style: "concise" }),
    );
  });

  it("separates conversations and custom instructions that shape the answer", () => {
    const k = decisionCacheKey(base);
    expect(decisionCacheKey({ ...base, history: [], instructions: "" })).toBe(k);
    const followUp = decisionCacheKey({
      ...base,
      history: [
        { role: "user", content: "Explain ACID" },
        { role: "assistant", content: "ACID stands for…" },
      ],
    });
    expect(followUp).not.toBe(k);
    expect(decisionCacheKey({ ...base, instructions: "Answer like a pirate" })).not.toBe(k);
  });

  it("never caches knowledge-base requests (private, per-user context)", () => {
    expect(decisionCacheKey({ ...base, useKnowledgeBase: true })).toBeNull();
    expect(decisionCacheKey({ ...base, documentIds: ["65f000000000000000000001"] })).toBeNull();
  });
});

describe("isRagRequest", () => {
  it("is true for the KB flag or any document scope", () => {
    expect(isRagRequest({})).toBe(false);
    expect(isRagRequest({ useKnowledgeBase: false, documentIds: [] })).toBe(false);
    expect(isRagRequest({ useKnowledgeBase: true })).toBe(true);
    expect(isRagRequest({ documentIds: ["x"] })).toBe(true);
  });
});
