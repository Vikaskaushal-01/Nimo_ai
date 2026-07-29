import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import {
  createConversationHandler,
  createConversationSchema,
  deleteConversationHandler,
  getConversationHandler,
  listConversationsHandler,
  listMessagesHandler,
  renameConversationHandler,
  renameConversationSchema,
} from "./chat.controller.js";

export const chatRouter = Router();

chatRouter.get("/conversations", listConversationsHandler);
chatRouter.post(
  "/conversations",
  validate(createConversationSchema),
  createConversationHandler,
);
chatRouter.get("/conversations/:id", getConversationHandler);
chatRouter.patch(
  "/conversations/:id",
  validate(renameConversationSchema),
  renameConversationHandler,
);
chatRouter.delete("/conversations/:id", deleteConversationHandler);
chatRouter.get("/conversations/:id/messages", listMessagesHandler);
