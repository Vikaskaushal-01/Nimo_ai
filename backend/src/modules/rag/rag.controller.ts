import { z } from "zod";
import { AppError } from "../../shared/AppError.js";
import { ok } from "../../shared/ApiResponse.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { currentUser } from "../../middleware/auth.js";
import * as rag from "./rag.service.js";

export const searchSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  documentIds: z.array(z.string()).max(50).optional(),
  topK: z.coerce.number().int().min(1).max(20).optional(),
});

const toPublicDoc = (d: {
  _id: unknown;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  chunkCount: number;
  charCount: number;
  error?: string;
  createdAt?: Date;
  updatedAt?: Date;
}) => ({
  id: String(d._id),
  filename: d.filename,
  mimeType: d.mimeType,
  sizeBytes: d.sizeBytes,
  status: d.status,
  chunkCount: d.chunkCount,
  charCount: d.charCount,
  error: d.error ?? "",
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

export const uploadHandler = asyncHandler(async (req, res) => {
  if (!req.file) throw AppError.badRequest("No file uploaded (field name: 'file')");
  // Multipart filenames arrive latin1-decoded; restore UTF-8 (e.g. "résumé.pdf").
  const filename = Buffer.from(req.file.originalname, "latin1").toString("utf8").slice(0, 300);
  const doc = await rag.ingestDocument({
    ownerId: currentUser(req).sub,
    filename,
    mimeType: req.file.mimetype,
    buffer: req.file.buffer,
  });
  ok(res, toPublicDoc(doc), 201);
});

export const listDocumentsHandler = asyncHandler(async (req, res) => {
  const docs = await rag.listDocuments(currentUser(req).sub);
  ok(res, docs.map(toPublicDoc));
});

export const getDocumentHandler = asyncHandler(async (req, res) => {
  const doc = await rag.getDocument(req.params.id, currentUser(req).sub);
  ok(res, toPublicDoc(doc));
});

export const deleteDocumentHandler = asyncHandler(async (req, res) => {
  await rag.deleteDocument(req.params.id, currentUser(req).sub);
  ok(res, { deleted: true });
});

export const searchHandler = asyncHandler(async (req, res) => {
  const { query, documentIds, topK } = req.body as z.infer<typeof searchSchema>;
  const sources = await rag.retrieve(currentUser(req).sub, query, { documentIds, topK });
  // Return previews only (omit full content) for the search endpoint.
  ok(
    res,
    sources.map(({ content, ...rest }) => {
      void content;
      return rest;
    }),
  );
});
