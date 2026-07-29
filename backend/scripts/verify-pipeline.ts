/**
 * Standalone end-to-end check of the decision ENGINE (no DB/Redis):
 * orchestrate → evaluate → rank → fuse, using the deterministic MockProvider.
 * Run: npx tsx scripts/verify-pipeline.ts
 */
import { orchestrate } from "../src/modules/orchestration/orchestrator.service.js";
import { evaluateResponses } from "../src/modules/evaluation/evaluation.service.js";
import { rankResponses } from "../src/modules/ranking/ranking.service.js";
import { fuseResponses } from "../src/modules/fusion/fusion.service.js";

const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error("❌ ASSERTION FAILED:", msg);
    process.exit(1);
  }
};

const main = async () => {
  const prompt = "Explain the CAP theorem and its practical trade-offs.";
  const models = [
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-sonnet",
    "google/gemini-flash-1.5",
    "deepseek/deepseek-chat",
  ];

  const { responses, failed } = await orchestrate(prompt, models);
  assert(responses.length === models.length, "all mock models should respond");
  assert(failed.length === 0, "no models should fail with mock provider");

  const evaluated = await evaluateResponses(prompt, responses);
  assert(evaluated.length === responses.length, "every response evaluated");
  for (const e of evaluated) {
    for (const [k, v] of Object.entries(e.metrics)) {
      assert(v >= 0 && v <= 1, `metric ${k} in [0,1] (got ${v})`);
    }
    assert(e.weightedScore >= 0 && e.weightedScore <= 1, "weighted score in [0,1]");
    assert(e.hallucinationRisk >= 0 && e.hallucinationRisk <= 1, "risk in [0,1]");
  }

  const ranking = rankResponses(evaluated);
  const confSum = ranking.reduce((a, r) => a + r.confidence, 0);
  assert(confSum === 100, `confidence must sum to exactly 100 (got ${confSum})`);
  assert(ranking[0].rank === 1, "first entry is rank 1");
  for (let i = 1; i < ranking.length; i++) {
    assert(ranking[i - 1].weightedScore >= ranking[i].weightedScore, "ranking is sorted desc");
  }

  const fusion = await fuseResponses(prompt, ranking);
  assert(fusion.optimizedAnswer.length > 0, "fused answer non-empty");

  console.log("✅ Pipeline OK");
  console.log("   models:        ", models.length);
  console.log("   confidence sum:", confSum);
  console.log(
    "   leaderboard:   ",
    ranking.map((r) => `${r.rank}. ${r.label} ${r.score}/100 (${r.confidence}%)`).join("  |  "),
  );
  console.log("   contributions: ", fusion.contributionMap.map((c) => c.section).join(", "));
  console.log("   answer preview:\n", fusion.optimizedAnswer.split("\n").slice(0, 4).join("\n"));
  process.exit(0);
};

main().catch((err) => {
  console.error("❌ Pipeline threw:", err);
  process.exit(1);
});
