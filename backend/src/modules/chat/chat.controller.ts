import { z } from "zod";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { ok } from "../../shared/ApiResponse.js";
import { currentUser } from "../../middleware/auth.js";
import * as chat from "./chat.service.js";

export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});

export const updateConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((v) => v.title !== undefined || v.pinned !== undefined, {
    message: "Provide a title or pinned flag",
  });

export const listConversationsHandler = asyncHandler(async (req, res) => {
  const conversations = await chat.listConversations(currentUser(req).sub);
  ok(res, conversations);
});

export const createConversationHandler = asyncHandler(async (req, res) => {
  const { title } = req.body as z.infer<typeof createConversationSchema>;
  const conversation = await chat.createConversation(currentUser(req).sub, title);
  ok(res, conversation, 201);
});

export const getConversationHandler = asyncHandler(async (req, res) => {
  const conversation = await chat.getConversation(req.params.id, currentUser(req).sub);
  ok(res, conversation);
});

export const updateConversationHandler = asyncHandler(async (req, res) => {
  const changes = req.body as z.infer<typeof updateConversationSchema>;
  const conversation = await chat.updateConversation(req.params.id, currentUser(req).sub, changes);
  ok(res, conversation);
});

export const deleteAllConversationsHandler = asyncHandler(async (req, res) => {
  const deleted = await chat.deleteAllConversations(currentUser(req).sub);
  ok(res, { deleted });
});

export const deleteConversationHandler = asyncHandler(async (req, res) => {
  await chat.deleteConversation(req.params.id, currentUser(req).sub);
  ok(res, { deleted: true });
});

export const listMessagesHandler = asyncHandler(async (req, res) => {
  const messages = await chat.listMessages(req.params.id, currentUser(req).sub);
  ok(res, messages);
});
