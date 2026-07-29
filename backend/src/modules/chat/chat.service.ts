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

export const listConversations = async (ownerId: string) => {
  return Conversation.find({ ownerId }).sort({ updatedAt: -1 }).limit(100).lean();
};

export const createConversation = async (ownerId: string, title?: string) => {
  return Conversation.create({ ownerId, title: title?.trim() || "New conversation" });
};

export const getConversation = async (id: string, ownerId: string) => {
  const conv = await loadOwned(id, ownerId);
  return conv.toObject();
};

export const renameConversation = async (id: string, ownerId: string, title: string) => {
  const conv = await loadOwned(id, ownerId);
  conv.title = title.trim();
  await conv.save();
  return conv.toObject();
};

export const deleteConversation = async (id: string, ownerId: string) => {
  await loadOwned(id, ownerId);
  await Conversation.findByIdAndDelete(id);
  await Message.deleteMany({ conversationId: id });
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
