import { createHash, randomBytes } from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.js";

export type UserRole = "user" | "admin";

export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
}

/** Sign a short-lived access JWT. */
export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  } as SignOptions);

/** Verify + decode an access JWT. Throws on invalid/expired. */
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
  return { sub: String(decoded.sub), email: decoded.email, role: decoded.role };
};

/**
 * Refresh tokens are opaque random strings (not JWTs). The raw value goes to
 * the client; only its SHA-256 hash is stored, so a DB leak cannot be replayed.
 */
export const generateRefreshToken = (): { raw: string; hash: string } => {
  const raw = randomBytes(48).toString("hex");
  return { raw, hash: hashToken(raw) };
};

export const hashToken = (raw: string): string =>
  createHash("sha256").update(raw).digest("hex");

/** Expiry timestamp for a freshly issued refresh token. */
export const refreshTokenExpiry = (): Date =>
  new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
