import { isValidObjectId } from "mongoose";
import { AppError } from "../../shared/AppError.js";
import type { DecisionResult } from "../../shared/engine.types.js";
import { Conversation } from "./conversation.model.js";
import { Message } from "./message.model.js";

const ensureId = (id: string): string => {
  if (!isValidObjectId(id)) throw AppError.badRequest(`Invalid id: ${id}`);
  return id;
};

/** Derive a short title from the first prompt. */
const deriveTitle = (prompt: string): string => {
  const clean = prompt.trim().replace(/\s+/g, " ");
  return clean.length <= 60 ? clean : `${clean.slice(0, 57)}…`;
};

/**
 * Loads a conversation and asserts it belongs to `ownerId`. Returns 404 (not
 * 403) for someone else's conversation so existence isn't leaked.
 */
const loadOwned = async (id: string, ownerId: string) => {
  ensureId(id);
  const conv = await Conversation.findById(id);
  if (!conv || conv.ownerId !== ownerId) throw AppError.notFound("Conversation not found");
  return conv;
};

/** Throws 400/404 unless `id` is a conversation owned by `ownerId`. */
export const assertConversationOwned = async (id: string, ownerId: string): Promise<void> => {
  await loadOwned(id, ownerId);
};

export const listConversations = async (ownerId: string) => {
  return Conversation.find({ ownerId }).sort({ pinned: -1, updatedAt: -1 }).limit(200).lean();
};

export const createConversation = async (ownerId: string, title?: string) => {
  return Conversation.create({ ownerId, title: title?.trim() || "New conversation" });
};

export const getConversation = async (id: string, ownerId: string) => {
  const conv = await loadOwned(id, ownerId);
  return conv.toObject();
};

export const updateConversation = async (
  id: string,
  ownerId: string,
  changes: { title?: string; pinned?: boolean },
) => {
  const conv = await loadOwned(id, ownerId);
  if (changes.title !== undefined) conv.title = changes.title.trim();
  if (changes.pinned !== undefined) conv.pinned = changes.pinned;
  // Renaming or pinning should not bump the chat to the top of "recent".
  await conv.save({ timestamps: false });
  return conv.toObject();
};

/** Deletes every conversation (and its messages) owned by the user. */
export const deleteAllConversations = async (ownerId: string): Promise<number> => {
  const ids = (await Conversation.find({ ownerId }).select("_id").lean()).map((c) => c._id);
  if (ids.length === 0) return 0;
  await Message.deleteMany({ conversationId: { $in: ids } });
  await Conversation.deleteMany({ _id: { $in: ids } });
  return ids.length;
};

export const deleteConversation = async (id: string, ownerId: string) => {
  await loadOwned(id, ownerId);
  // Messages first: if this fails midway the conversation still exists and the
  // delete can be retried, instead of leaving orphaned messages behind.
  await Message.deleteMany({ conversationId: id });
  await Conversation.findByIdAndDelete(id);
};

export const listMessages = async (conversationId: string, ownerId: string) => {
  await loadOwned(conversationId, ownerId);
  return Message.find({ conversationId }).sort({ createdAt: 1 }).lean();
};

/**
 * Persists a completed decision as a message owned by `ownerId`, creating the
 * conversation if needed and keeping its metadata in sync.
 */
export const persistDecision = async (
  result: DecisionResult,
  ownerId: string,
  conversationId?: string,
): Promise<{ conversationId: string; messageId: string }> => {
  let convId: string;

  if (conversationId) {
    const conv = await loadOwned(conversationId, ownerId);
    convId = conv._id.toString();
  } else {
    const created = await Conversation.create({
      ownerId,
      title: deriveTitle(result.prompt),
      lastModelSet: result.meta.requestedModels,
    });
    convId = created.id;
  }

  const message = await Message.create({
    conversationId: convId,
    prompt: result.prompt,
    requestedModels: result.meta.requestedModels,
    optimizedAnswer: result.optimizedAnswer,
    reasoningSummary: result.reasoningSummary,
    contributionMap: result.contributionMap,
    ranking: result.ranking,
    meta: result.meta,
  });

  await Conversation.findByIdAndUpdate(convId, {
    $inc: { messageCount: 1 },
    $set: { lastModelSet: result.meta.requestedModels, updatedAt: new Date() },
  });

  return { conversationId: convId, messageId: message._id.toString() };
};
