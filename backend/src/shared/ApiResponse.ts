import type { Response } from "express";

/** Standardized success envelope returned by every endpoint. */
export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/** Standardized error envelope. */
export interface ErrorEnvelope {
  success: false;
  error: {
    message: string;
    statusCode: number;
    details?: unknown;
  };
}

export const ok = <T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Record<string, unknown>,
): Response => {
  const body: SuccessEnvelope<T> = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

export const fail = (
  res: Response,
  message: string,
  statusCode = 500,
  details?: unknown,
): Response => {
  const body: ErrorEnvelope = {
    success: false,
    error: { message, statusCode, details },
  };
  return res.status(statusCode).json(body);
};
