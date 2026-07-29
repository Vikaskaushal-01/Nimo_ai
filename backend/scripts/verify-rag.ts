/**
 * DB-free check of the RAG building blocks: text extraction (text format),
 * chunking, embedding (mock/lexical), and cosine retrieval ranking — proving a
 * relevant query surfaces the right chunk.
 * Run: npx tsx scripts/verify-rag.ts
 */
import { extractText } from "../src/modules/rag/parse.js";
import { chunkText } from "../src/modules/rag/chunking.js";
import { rankByCosine } from "../src/modules/rag/retrieval.js";
import { embedOne, embedTexts } from "../src/modules/embeddings/embeddings.service.js";

const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error("❌ ASSERTION FAILED:", msg);
    process.exit(1);
  }
};

const main = async () => {
  const doc = [
    "The CAP theorem states that a distributed system can provide at most two of consistency, availability, and partition tolerance.",
    "Optimistic locking assumes conflicts are rare and validates at commit time using a version field.",
    "Pessimistic locking acquires locks up front to prevent concurrent modification, trading throughput for safety.",
    "Database indexing speeds up reads by maintaining a sorted structure, at the cost of slower writes.",
  ].join("\n\n");

  // 1. Extract (text path) + chunk
  const text = await extractText(Buffer.from(doc, "utf8"), "notes.txt", "text/plain");
  assert(text.includes("CAP theorem"), "extraction returns text");
  const chunks = chunkText(text, { size: 160, overlap: 40 });
  assert(chunks.length >= 2, "document split into multiple chunks");

  // 2. Embed chunks
  const vectors = await embedTexts(chunks.map((c) => c.content));
  assert(vectors.length === chunks.length, "one vector per chunk");

  // 3. Retrieve for a query about locking
  const query = "How does optimistic locking detect conflicts?";
  const qv = await embedOne(query);
  const top = rankByCosine(
    qv,
    chunks.map((c, i) => ({ content: c.content, embedding: vectors[i] })),
    1,
  );
  assert(top.length === 1, "retrieval returns top-1");
  assert(/optimistic/i.test(top[0].item.content), `top chunk is about optimistic locking (got: "${top[0].item.content.slice(0, 60)}…")`);

  console.log("✅ RAG pipeline OK");
  console.log("   chunks:        ", chunks.length);
  console.log("   query:         ", query);
  console.log("   top match score:", top[0].score.toFixed(3));
  console.log("   top chunk:     ", `${top[0].item.content.slice(0, 70)}…`);
  process.exit(0);
};

main().catch((err) => {
  console.error("❌ RAG pipeline threw:", err);
  process.exit(1);
});
