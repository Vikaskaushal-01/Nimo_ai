import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { AppError } from "../shared/AppError.js";

type Source = "body" | "query" | "params";

/**
 * Validates and replaces a request segment with the parsed (typed) result.
 * Throws a 422 AppError with field-level details on failure.
 */
export const validate =
  (schema: ZodTypeAny, source: Source = "body") =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]);
      // Overwrite with the coerced/validated value.
      (req as unknown as Record<Source, unknown>)[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(AppError.unprocessable("Validation failed", err.flatten().fieldErrors));
        return;
      }
      next(err);
    }
  };

export type Infer<T extends ZodTypeAny> = z.infer<T>;
