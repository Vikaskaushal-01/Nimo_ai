import type { NextFunction, Request, Response } from "express";
import { AppError } from "../shared/AppError.js";
import {
  verifyAccessToken,
  type AccessTokenPayload,
  type UserRole,
} from "../modules/auth/token.util.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

const extractToken = (req: Request): string | null => {
  const header = req.header("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
};

/** Requires a valid access token; attaches `req.user`. */
export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = extractToken(req);
  if (!token) {
    next(AppError.unauthorized("Authentication required"));
    return;
  }
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(AppError.unauthorized("Invalid or expired token"));
  }
};

/** Requires one of the given roles (after requireAuth). */
export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized("Authentication required"));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError("Insufficient permissions", 403));
      return;
    }
    next();
  };

/** Convenience accessor that asserts an authenticated user is present. */
export const currentUser = (req: Request): AccessTokenPayload => {
  if (!req.user) throw AppError.unauthorized("Authentication required");
  return req.user;
};
