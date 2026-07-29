/**
 * DB-free check of the STREAMING engine: orchestrateStream emits live token
 * deltas and per-model completion, then evaluate → rank still work on the
 * streamed responses. Uses the deterministic MockProvider.
 * Run: npx tsx scripts/verify-stream.ts
 */
import { orchestrateStream } from "../src/modules/orchestration/orchestrator.service.js";
import { evaluateResponses } from "../src/modules/evaluation/evaluation.service.js";
import { rankResponses } from "../src/modules/ranking/ranking.service.js";

const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error("❌ ASSERTION FAILED:", msg);
    process.exit(1);
  }
};

const main = async () => {
  const prompt = "Compare optimistic vs pessimistic locking.";
  const models = [
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-sonnet",
    "google/gemini-flash-1.5",
  ];

  const tokenCounts: Record<string, number> = {};
  let doneEvents = 0;

  const { responses, failed } = await orchestrateStream(prompt, models, {
    onToken: (model) => {
      tokenCounts[model] = (tokenCounts[model] ?? 0) + 1;
    },
    onModelDone: () => {
      doneEvents += 1;
    },
    onModelError: () => undefined,
  });

  assert(responses.length === models.length, "all models streamed to completion");
  assert(failed.length === 0, "no failures with mock provider");
  assert(doneEvents === models.length, "model_done fired for each model");
  for (const m of models) {
    assert((tokenCounts[m] ?? 0) > 5, `model ${m} emitted multiple token deltas`);
  }

  const evaluated = await evaluateResponses(prompt, responses);
  const ranking = rankResponses(evaluated);
  const confSum = ranking.reduce((a, r) => a + r.confidence, 0);
  assert(confSum === 100, `confidence sums to 100 (got ${confSum})`);

  console.log("✅ Streaming pipeline OK");
  console.log("   models streamed:", responses.length);
  console.log("   token deltas:   ", models.map((m) => `${m.split("/")[1]}=${tokenCounts[m]}`).join("  "));
  console.log("   confidence sum: ", confSum);
  process.exit(0);
};

main().catch((err) => {
  console.error("❌ Streaming pipeline threw:", err);
  process.exit(1);
});
