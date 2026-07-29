import { Schema, model, type InferSchemaType, type Types } from "mongoose";

export type DocumentStatus = "processing" | "ready" | "failed";

/**
 * An uploaded knowledge-base source. The extracted text is split into `Chunk`
 * documents (each with its own embedding) for retrieval; this record holds the
 * file metadata and ingestion status.
 */
const documentSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    filename: { type: String, required: true, trim: true, maxlength: 300 },
    mimeType: { type: String, default: "" },
    sizeBytes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["processing", "ready", "failed"],
      default: "processing",
      index: true,
    },
    chunkCount: { type: Number, default: 0 },
    charCount: { type: Number, default: 0 },
    error: { type: String, default: "" },
  },
  { timestamps: true },
);

documentSchema.index({ ownerId: 1, updatedAt: -1 });

export type DocumentDoc = InferSchemaType<typeof documentSchema> & { _id: Types.ObjectId };
export const KbDocument = model("Document", documentSchema);
