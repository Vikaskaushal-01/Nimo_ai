import { describe, expect, it } from "vitest";
import { chunkText } from "./chunking.js";
import { rankByCosine } from "./retrieval.js";

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    const chunks = chunkText("hello world", { size: 100 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ index: 0, content: "hello world" });
  });

  it("returns no chunks for empty/whitespace text", () => {
    expect(chunkText("   \n  ")).toEqual([]);
  });

  it("splits long text into multiple ordered chunks", () => {
    const text = Array.from({ length: 50 }, (_, i) => `sentence number ${i}.`).join(" ");
    const chunks = chunkText(text, { size: 120, overlap: 30 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => expect(c.index).toBe(i));
  });

  it("produces overlapping consecutive chunks", () => {
    const text = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(text, { size: 100, overlap: 40 });
    // The tail of one chunk should reappear at the head of the next.
    const tail = chunks[0].content.split(" ").slice(-3).join(" ");
    expect(chunks[1].content).toContain(tail.split(" ")[2]);
  });

  it("covers the whole input (no dropped words)", () => {
    const words = Array.from({ length: 60 }, (_, i) => `t${i}`);
    const text = words.join(" ");
    const chunks = chunkText(text, { size: 80, overlap: 20 });
    const joined = chunks.map((c) => c.content).join(" ");
    for (const w of words) expect(joined).toContain(w);
  });
});

describe("rankByCosine", () => {
  const items = [
    { id: "a", embedding: [1, 0, 0] },
    { id: "b", embedding: [0, 1, 0] },
    { id: "c", embedding: [0.9, 0.1, 0] },
  ];

  it("ranks the most similar items first", () => {
    const ranked = rankByCosine([1, 0, 0], items, 3);
    expect(ranked[0].item.id).toBe("a");
    expect(ranked[1].item.id).toBe("c");
    expect(ranked[2].item.id).toBe("b");
  });

  it("respects top-k", () => {
    expect(rankByCosine([1, 0, 0], items, 2)).toHaveLength(2);
  });

  it("returns scores in [0,1] descending", () => {
    const ranked = rankByCosine([1, 0, 0], items, 3);
    for (const r of ranked) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it("handles empty item list", () => {
    expect(rankByCosine([1, 0], [], 5)).toEqual([]);
  });
});
