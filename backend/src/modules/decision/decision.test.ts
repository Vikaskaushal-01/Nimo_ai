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
