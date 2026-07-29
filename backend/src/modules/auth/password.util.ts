import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";

/** Hash a plaintext password with the configured bcrypt cost. */
export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, env.BCRYPT_ROUNDS);

/** Constant-time compare of a plaintext against a stored hash. */
export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);
