import { isValidObjectId } from "mongoose";
import { AppError } from "../../shared/AppError.js";
import { logger } from "../../shared/logger.js";
import type { RetrievedSource } from "../../shared/engine.types.js";
import {
  EMBED_DIM,
  embedOne,
  embedTexts,
  lexicalVector,
} from "../embeddings/embeddings.service.js";
import { Chunk } from "./chunk.model.js";
import { chunkText } from "./chunking.js";
import { KbDocument, type DocumentDoc } from "./document.model.js";
import { extractText } from "./parse.js";
import { rankByCosine } from "./retrieval.js";

const ensureId = (id: string): string => {
  if (!isValidObjectId(id)) throw AppError.badRequest(`Invalid id: ${id}`);
  return id;
};

export interface UploadInput {
  ownerId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * Ingests a file: extract text → chunk → embed → store. Creates the Document in
 * `processing`, then flips to `ready` (or `failed` with the error) so the UI can
 * reflect progress. Processing is inline here; a later iteration can move it to a
 * background queue without changing the interface.
 */
export const ingestDocument = async (input: UploadInput): Promise<DocumentDoc> => {
  const doc = await KbDocument.create({
    ownerId: input.ownerId,
    filename: input.filename,
    mimeType: input.mimeType,
    sizeBytes: input.buffer.length,
    status: "processing",
  });

  try {
    const text = await extractText(input.buffer, input.filename, input.mimeType);
    const chunks = chunkText(text);
    if (chunks.length === 0) throw AppError.unprocessable("No extractable text found in file");

    const vectors = await embedTexts(chunks.map((c) => c.content));
    await Chunk.insertMany(
      chunks.map((c, i) => ({
        documentId: doc._id,
        ownerId: input.ownerId,
        filename: input.filename,
        index: c.index,
        content: c.content,
        embedding: vectors[i] ?? [],
      })),
    );

    doc.status = "ready";
    doc.chunkCount = chunks.length;
    doc.charCount = text.length;
    await doc.save();
    logger.info("Document ingested", { id: doc.id, chunks: chunks.length });
    return doc;
  } catch (err) {
    // Drop any chunks written before the failure so they can't be retrieved.
    await Chunk.deleteMany({ documentId: doc._id }).catch(() => undefined);
    doc.status = "failed";
    // Only operational errors (unsupported type, empty file) are user-facing.
    doc.error = err instanceof AppError ? err.message : "Could not process this file.";
    await doc.save();
    logger.warn("Document ingestion failed", { id: doc.id, error: String(err) });
    return doc;
  }
};

export const listDocuments = async (ownerId: string): Promise<DocumentDoc[]> =>
  KbDocument.find({ ownerId }).sort({ updatedAt: -1 }).limit(200).lean() as unknown as Promise<
    DocumentDoc[]
  >;

export const getDocument = async (id: string, ownerId: string): Promise<DocumentDoc> => {
  ensureId(id);
  const doc = await KbDocument.findById(id).lean();
  if (!doc || doc.ownerId !== ownerId) throw AppError.notFound("Document not found");
  return doc as unknown as DocumentDoc;
};

export const deleteDocument = async (id: string, ownerId: string): Promise<void> => {
  await getDocument(id, ownerId);
  // Chunks first so a partial failure never leaves retrievable orphans.
  await Chunk.deleteMany({ documentId: id });
  await KbDocument.findByIdAndDelete(id);
};

export interface RetrieveOptions {
  /** Restrict to specific documents; empty/undefined searches all owner docs. */
  documentIds?: string[];
  topK?: number;
}

/**
 * Retrieves the most relevant chunks for a query across the owner's knowledge
 * base (optionally restricted to `documentIds`), ranked by cosine similarity.
 */
export const retrieve = async (
  ownerId: string,
  query: string,
  { documentIds, topK = 5 }: RetrieveOptions = {},
): Promise<RetrievedSource[]> => {
  const filter: Record<string, unknown> = { ownerId };
  if (documentIds && documentIds.length > 0) {
    filter.documentId = { $in: documentIds.filter(isValidObjectId) };
  }

  const chunks = await Chunk.find(filter).limit(2000).lean();
  if (chunks.length === 0) return [];

  // Chunks embedded while the provider was unavailable carry lexical vectors,
  // whose dimension differs from provider vectors. Score each group against a
  // query vector from the same space so neither silently scores 0.
  const queryVec = await embedOne(query);
  const lexicalQuery = lexicalVector(query);
  const items = chunks.map((c) => ({ ...c, embedding: c.embedding as number[] }));
  const sameSpace = items.filter((c) => c.embedding.length === queryVec.length);
  const lexical =
    queryVec.length === EMBED_DIM
      ? []
      : items.filter((c) => c.embedding.length === EMBED_DIM);
  const ranked = [
    ...rankByCosine(queryVec, sameSpace, topK),
    ...rankByCosine(lexicalQuery, lexical, topK),
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return ranked
    .filter((r) => r.score > 0)
    .map((r) => ({
      documentId: String(r.item.documentId),
      filename: r.item.filename,
      chunkIndex: r.item.index,
      score: Number(r.score.toFixed(4)),
      snippet: r.item.content.slice(0, 240),
      content: r.item.content,
    }));
};

/** Formats retrieved chunks into a context block for prompt injection. */
export const buildContextBlock = (sources: RetrievedSource[]): string => {
  if (sources.length === 0) return "";
  const blocks = sources
    .map(
      (s, i) => `[Source ${i + 1}: ${s.filename} #${s.chunkIndex}]\n${s.content}`,
    )
    .join("\n\n");
  return (
    "Use the following retrieved context to ground your answer. " +
    "Cite sources as [Source N] where relevant. If the context is insufficient, say so.\n\n" +
    `=== CONTEXT ===\n${blocks}\n=== END CONTEXT ===`
  );
};
