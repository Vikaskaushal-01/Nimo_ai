import { Router } from "express";
import multer from "multer";
import { validate } from "../../middleware/validate.js";
import {
  deleteDocumentHandler,
  getDocumentHandler,
  listDocumentsHandler,
  searchHandler,
  searchSchema,
  uploadHandler,
} from "./rag.controller.js";

// In-memory upload: the buffer is parsed + chunked, not persisted to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 }, // 15 MB
});

export const ragRouter = Router();

ragRouter.post("/knowledge/documents", upload.single("file"), uploadHandler);
ragRouter.get("/knowledge/documents", listDocumentsHandler);
ragRouter.get("/knowledge/documents/:id", getDocumentHandler);
ragRouter.delete("/knowledge/documents/:id", deleteDocumentHandler);
ragRouter.post("/knowledge/search", validate(searchSchema), searchHandler);
