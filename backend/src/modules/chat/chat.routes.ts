import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import {
  createConversationHandler,
  createConversationSchema,
  deleteAllConversationsHandler,
  deleteConversationHandler,
  deleteMessagesFromHandler,
  getConversationHandler,
  listConversationsHandler,
  listMessagesHandler,
  messageFeedbackHandler,
  messageFeedbackSchema,
  updateConversationHandler,
  updateConversationSchema,
} from "./chat.controller.js";

export const chatRouter = Router();

chatRouter.get("/conversations", listConversationsHandler);
chatRouter.delete("/conversations", deleteAllConversationsHandler);
chatRouter.post(
  "/conversations",
  validate(createConversationSchema),
  createConversationHandler,
);
chatRouter.get("/conversations/:id", getConversationHandler);
chatRouter.patch(
  "/conversations/:id",
  validate(updateConversationSchema),
  updateConversationHandler,
);
chatRouter.delete("/conversations/:id", deleteConversationHandler);
chatRouter.get("/conversations/:id/messages", listMessagesHandler);
// Cuts the thread back to (and including) this message — for edit / regenerate.
chatRouter.delete("/conversations/:id/messages/:messageId", deleteMessagesFromHandler);
chatRouter.patch(
  "/conversations/:id/messages/:messageId",
  validate(messageFeedbackSchema),
  messageFeedbackHandler,
);
