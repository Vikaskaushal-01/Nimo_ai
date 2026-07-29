import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * A conversation groups messages. Auth/workspace ownership is deferred to a
 * later iteration; `ownerId` is kept optional now so the field is already
 * present when RBAC lands.
 */
const conversationSchema = new Schema(
  {
    title: { type: String, required: true, default: "New conversation", trim: true, maxlength: 200 },
    ownerId: { type: String, default: null, index: true },
    lastModelSet: { type: [String], default: [] },
    messageCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

conversationSchema.index({ updatedAt: -1 });

export type ConversationDoc = InferSchemaType<typeof conversationSchema>;
export const Conversation = model("Conversation", conversationSchema);
