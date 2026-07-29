import { describe, expect, it } from "vitest";
import { accuracy } from "./accuracy.js";
import { completeness } from "./completeness.js";
import { contextPreservation } from "./contextPreservation.js";
import { hallucinationRisk } from "./hallucination.js";
import { readability } from "./readability.js";
import { reasoning } from "./reasoning.js";
import { semanticSimilarity } from "./semanticSimilarity.js";
import { clamp01, cosine, jaccard } from "./text.util.js";

const inRange = (v: number) => v >= 0 && v <= 1;

describe("text.util", () => {
  it("clamp01 bounds values", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });

  it("cosine of identical vectors is 1, orthogonal is 0", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("jaccard of identical text is 1, disjoint is 0", () => {
    expect(jaccard("alpha beta", "alpha beta")).toBeCloseTo(1);
    expect(jaccard("alpha beta", "gamma delta")).toBe(0);
  });
});

describe("semanticSimilarity", () => {
  it("returns 1 for a single response", () => {
    expect(semanticSimilarity(0, [[1, 0, 0]])).toBe(1);
  });

  it("scores an aligned response higher than an outlier", () => {
    const vectors = [
      [1, 0, 0],
      [0.99, 0.1, 0],
      [0, 0, 1], // outlier
    ];
    const aligned = semanticSimilarity(0, vectors);
    const outlier = semanticSimilarity(2, vectors);
    expect(aligned).toBeGreaterThan(outlier);
    expect(inRange(aligned)).toBe(true);
  });
});

describe("completeness", () => {
  it("rewards longer, structured content over terse content", () => {
    const terse = "Yes.";
    const rich = [
      "## Overview",
      "Here is a thorough explanation with several points.",
      "1. First point with detail.",
      "2. Second point with more detail.",
      "```ts\nconst x = 1;\n```",
    ].join("\n");
    const max = 60;
    expect(completeness(rich, max)).toBeGreaterThan(completeness(terse, max));
    expect(inRange(completeness(rich, max))).toBe(true);
  });
});

describe("accuracy", () => {
  it("rewards cross-model agreement", () => {
    const contents = [
      "the capital of france is paris a major european city",
      "paris is the capital of france and a major european city",
      "bananas are yellow tropical fruit unrelated topic entirely",
    ];
    const agreeing = accuracy(0, contents);
    const outlier = accuracy(2, contents);
    expect(agreeing).toBeGreaterThan(outlier);
  });

  it("returns a neutral prior for a lone response", () => {
    expect(accuracy(0, ["only one"])).toBeCloseTo(0.7);
  });
});

describe("reasoning", () => {
  it("scores explicit reasoning above a bare assertion", () => {
    const reasoned =
      "First, because the input is unsorted, we must sort it. Therefore the cost is " +
      "O(n log n). However, if it is already sorted, we can skip that step. " +
      "For example, consider an array of ten elements.";
    const bare = "Sort it. Done.";
    expect(reasoning(reasoned)).toBeGreaterThan(reasoning(bare));
    expect(inRange(reasoning(reasoned))).toBe(true);
  });
});

describe("readability", () => {
  it("returns a value in range and prefers clear prose", () => {
    const clear = "The cat sat on the mat. It was a warm day. The sun was out.";
    const dense =
      "Notwithstanding the aforementioned epistemological considerations, the multifaceted " +
      "ramifications necessitate comprehensive interdisciplinary reconceptualization.";
    expect(inRange(readability(clear))).toBe(true);
    expect(readability(clear)).toBeGreaterThan(readability(dense));
  });
});

describe("contextPreservation", () => {
  it("scores on-topic answers higher than off-topic", () => {
    const prompt = "Explain how database indexing improves query performance";
    const onTopic =
      "Database indexing improves query performance by letting the engine locate rows " +
      "without scanning the whole table.";
    const offTopic = "I really enjoy hiking in the mountains during summer.";
    expect(contextPreservation(prompt, onTopic)).toBeGreaterThan(
      contextPreservation(prompt, offTopic),
    );
  });
});

describe("hallucinationRisk", () => {
  it("rises as agreement falls", () => {
    const low = hallucinationRisk(0.9, 0.9, "a grounded answer");
    const high = hallucinationRisk(0.1, 0.3, "an ungrounded answer");
    expect(high).toBeGreaterThan(low);
    expect(inRange(low)).toBe(true);
    expect(inRange(high)).toBe(true);
  });
});
