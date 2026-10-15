import { Schema, model, Types, type InferSchemaType } from "mongoose";

/**
 * A message stores the user prompt AND the full decision result (per-model
 * ranking + fused answer + analytics meta) so a conversation can be replayed
 * with all comparison data intact. The decision payload is stored loosely
 * (Mixed) because its shape is owned by the engine types, not the DB layer.
 */
const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    prompt: { type: String, required: true },
    requestedModels: { type: [String], default: [] },

    optimizedAnswer: { type: String, default: "" },
    reasoningSummary: { type: String, default: "" },
    contributionMap: { type: Schema.Types.Mixed, default: [] },
    ranking: { type: Schema.Types.Mixed, default: [] },
    meta: { type: Schema.Types.Mixed, default: {} },
    followUps: { type: [String], default: [] },
    /** The user's thumbs up/down on the fused answer. */
    feedback: { type: String, enum: ["up", "down", null], default: null },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export type MessageDoc = InferSchemaType<typeof messageSchema> & { _id: Types.ObjectId };
export const Message = model("Message", messageSchema);
