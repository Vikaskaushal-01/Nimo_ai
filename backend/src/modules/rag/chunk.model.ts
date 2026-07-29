import { Schema, model, type InferSchemaType, type Types } from "mongoose";

/**
 * A retrievable text chunk with its embedding vector. Retrieval loads an
 * owner's chunks and ranks them by cosine similarity in-app (works on plain
 * MongoDB; a later iteration can swap in Atlas Vector Search behind the same
 * service interface).
 */
const chunkSchema = new Schema(
  {
    documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    filename: { type: String, default: "" },
    index: { type: Number, required: true },
    content: { type: String, required: true },
    embedding: { type: [Number], default: [] },
  },
  { timestamps: true },
);

chunkSchema.index({ ownerId: 1, documentId: 1, index: 1 });

export type ChunkDoc = InferSchemaType<typeof chunkSchema> & { _id: Types.ObjectId };
export const Chunk = model("Chunk", chunkSchema);
