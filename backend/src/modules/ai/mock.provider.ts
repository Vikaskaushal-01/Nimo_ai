import { findModel } from "../../config/providers.js";
import type {
  ChatRequest,
  ChatResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  IProvider,
  OnDelta,
} from "./provider.types.js";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Deterministic offline provider used when no OPENROUTER_API_KEY is set.
 * Produces varied, model-flavoured responses so the full
 * evaluate → rank → fuse pipeline (and the UI) run end-to-end with no network.
 *
 * Everything here is a pure function of (model, prompt) — no randomness — so
 * results are reproducible and cacheable.
 */
export class MockProvider implements IProvider {
  public readonly name = "mock";

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const userMsg = [...req.messages].reverse().find((m) => m.role === "user");
    const prompt = userMsg?.content ?? "";
    const flavour = MODEL_FLAVOUR[hash(req.model) % MODEL_FLAVOUR.length];

    // If this is a fusion request (system prompt asks for JSON), emit valid JSON
    // so the fusion service's parser succeeds offline.
    const wantsJson = req.json || req.messages.some((m) => /respond.*json/i.test(m.content));
    if (wantsJson) {
      return this.synthetic(req.model, this.fusionJson(prompt));
    }

    const label = findModel(req.model)?.label ?? req.model;
    const content = this.answer(label, flavour, prompt);
    return this.synthetic(req.model, content);
  }

  async chatStream(req: ChatRequest, onDelta: OnDelta): Promise<ChatResponse> {
    const full = await this.chat(req);
    // Simulate token streaming by emitting word-sized chunks with small gaps,
    // so the live UI behaves exactly as it will against a real provider.
    const chunks = full.content.match(/\S+\s*/g) ?? [full.content];
    for (const chunk of chunks) {
      if (req.signal?.aborted) throw new Error("Request cancelled");
      onDelta(chunk);
      await sleep(8);
    }
    return full;
  }

  async embed(req: EmbeddingRequest): Promise<EmbeddingResponse> {
    return {
      model: req.model,
      vectors: req.input.map((text) => bagOfWordsVector(text)),
    };
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private synthetic(model: string, content: string): ChatResponse {
    const completionTokens = Math.ceil(content.length / 4);
    const promptTokens = 64;
    return {
      model,
      content,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }

  private answer(label: string, flavour: Flavour, prompt: string): string {
    const topic = prompt.trim().slice(0, 120) || "the question";
    return [
      `## ${flavour.heading}`,
      ``,
      `${flavour.intro} Regarding **${topic}**, here is a ${flavour.tone} perspective.`,
      ``,
      `### Key points`,
      ...flavour.points.map((p, i) => `${i + 1}. ${p}`),
      ``,
      `### Example`,
      "```ts",
      `// ${label} illustrative snippet`,
      `function solve(input: string): string {`,
      `  return input.trim().toLowerCase();`,
      `}`,
      "```",
      ``,
      `### Summary`,
      flavour.summary,
      ``,
      `_(Generated offline by the MockProvider as ${label} — set OPENROUTER_API_KEY for real responses.)_`,
    ].join("\n");
  }

  private fusionJson(prompt: string): string {
    return JSON.stringify({
      optimizedAnswer: [
        `## Optimized Answer`,
        ``,
        `This fused response synthesizes the strongest points from every model regarding "${prompt
          .trim()
          .slice(0, 80)}".`,
        ``,
        `- It keeps the most accurate reasoning.`,
        `- It removes duplicated explanations.`,
        `- It improves structure and readability.`,
        ``,
        `### Summary`,
        `A single coherent answer that is stronger than any individual model output.`,
      ].join("\n"),
      reasoningSummary:
        "Merged the clearest introduction, the deepest technical section, and the most concise summary across models; resolved overlaps by preferring higher-scoring responses.",
      contributionMap: [
        { section: "Introduction", models: ["top-ranked"] },
        { section: "Technical Details", models: ["highest reasoning"] },
        { section: "Summary", models: ["most concise"] },
      ],
    });
  }
}

interface Flavour {
  heading: string;
  intro: string;
  tone: string;
  points: string[];
  summary: string;
}

const MODEL_FLAVOUR: Flavour[] = [
  {
    heading: "A structured take",
    intro: "Let's break this down carefully.",
    tone: "rigorous",
    points: [
      "Define the core concepts precisely before reasoning about trade-offs.",
      "Consider edge cases and failure modes explicitly.",
      "Prefer well-established patterns over clever shortcuts.",
    ],
    summary: "Precision first, then pragmatism.",
  },
  {
    heading: "A practical overview",
    intro: "Here's the pragmatic view.",
    tone: "hands-on",
    points: [
      "Start with the simplest thing that works.",
      "Measure before optimizing.",
      "Document the decision so others can follow it.",
    ],
    summary: "Ship something correct, then iterate.",
  },
  {
    heading: "A deep technical analysis",
    intro: "Going a level deeper.",
    tone: "detailed",
    points: [
      "The underlying mechanism matters for performance characteristics.",
      "Concurrency and consistency must be reasoned about together.",
      "Benchmark under representative load, not synthetic best-case.",
    ],
    summary: "Depth reveals constraints that surface-level answers miss.",
  },
  {
    heading: "A concise explanation",
    intro: "Briefly:",
    tone: "succinct",
    points: [
      "Identify the goal.",
      "Pick the tool that fits.",
      "Validate the result.",
    ],
    summary: "Short, correct, and to the point.",
  },
];

/** Deterministic 32-bit string hash (FNV-1a). */
const hash = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/**
 * Cheap deterministic embedding: a fixed-dimension bag-of-words frequency
 * vector hashed into buckets. Good enough for cosine similarity to be
 * meaningful between related texts in offline mode.
 */
const DIM = 256;
const bagOfWordsVector = (text: string): number[] => {
  const vec = new Array<number>(DIM).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const tok of tokens) {
    vec[hash(tok) % DIM] += 1;
  }
  const norm = Math.sqrt(vec.reduce((a, b) => a + b * b, 0)) || 1;
  return vec.map((v) => v / norm);
};
