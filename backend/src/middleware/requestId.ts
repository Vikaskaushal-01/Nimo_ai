import type { NextFunction, Request, Response } from "express";
import { nanoid } from "nanoid";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

/** Attaches a correlation id to each request, echoed back via X-Request-Id. */
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const incoming = req.header("x-request-id");
  req.id = incoming && incoming.length <= 64 ? incoming : nanoid(12);
  res.setHeader("X-Request-Id", req.id);
  next();
};
