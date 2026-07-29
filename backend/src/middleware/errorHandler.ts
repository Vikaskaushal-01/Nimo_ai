import type { NextFunction, Request, Response } from "express";
import { AppError } from "../shared/AppError.js";
import { fail } from "../shared/ApiResponse.js";
import { logger } from "../shared/logger.js";

/** 404 handler for unmatched routes. */
export const notFoundHandler = (req: Request, res: Response): void => {
  fail(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
};

/** Central error handler. Must be registered last. */
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { requestId: req.id, details: err.details });
    }
    fail(res, err.message, err.statusCode, err.details);
    return;
  }

  // Multer upload errors (e.g. file too large) → 400, not a server fault.
  if (err instanceof Error && err.name === "MulterError") {
    fail(res, `Upload error: ${err.message}`, 400);
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  logger.error("Unhandled error", { requestId: req.id, message, stack: (err as Error)?.stack });
  fail(res, "Internal server error", 500);
};
