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

/** Loads a message of an owned conversation, or 404s. */
const loadOwnedMessage = async (conversationId: string, messageId: string, ownerId: string) => {
  await loadOwned(conversationId, ownerId);
  ensureId(messageId);
  const message = await Message.findOne({ _id: messageId, conversationId });
  if (!message) throw AppError.notFound("Message not found");
  return message;
};

/**
 * Deletes a message and everything after it in the conversation. Used to edit
 * a prompt or regenerate an answer: the thread is cut back to that point and
 * the new turn is sent in its place, keeping the conversation history linear.
 */
export const deleteMessagesFrom = async (
  conversationId: string,
  messageId: string,
  ownerId: string,
): Promise<number> => {
  const message = await loadOwnedMessage(conversationId, messageId, ownerId);
  const { deletedCount } = await Message.deleteMany({
    conversationId,
    createdAt: { $gte: message.createdAt },
  });
  const remaining = await Message.countDocuments({ conversationId });
  await Conversation.findByIdAndUpdate(conversationId, { $set: { messageCount: remaining } });
  return deletedCount;
};

/** Records (or clears, with null) the user's thumbs up/down on an answer. */
export const setMessageFeedback = async (
  conversationId: string,
  messageId: string,
  ownerId: string,
  feedback: "up" | "down" | null,
) => {
  const message = await loadOwnedMessage(conversationId, messageId, ownerId);
  message.feedback = feedback;
  await message.save({ timestamps: false });
  return { id: message._id.toString(), feedback };
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
    followUps: result.followUps ?? [],
    ranking: result.ranking,
    meta: result.meta,
  });

  await Conversation.findByIdAndUpdate(convId, {
    $inc: { messageCount: 1 },
    $set: { lastModelSet: result.meta.requestedModels, updatedAt: new Date() },
  });

  return { conversationId: convId, messageId: message._id.toString() };
};
