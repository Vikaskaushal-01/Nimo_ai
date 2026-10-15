import { AppError } from "../../shared/AppError.js";
import { RefreshToken } from "./refreshToken.model.js";
import { hashPassword, verifyPassword } from "./password.util.js";
import {
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
  signAccessToken,
} from "./token.util.js";
import { toPublicUser, User, type PublicUser } from "./user.model.js";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: PublicUser;
}

const issueTokens = async (
  userId: string,
  email: string,
  role: "user" | "admin",
  userAgent: string,
): Promise<AuthTokens> => {
  const accessToken = signAccessToken({ sub: userId, email, role });
  const { raw, hash } = generateRefreshToken();
  await RefreshToken.create({
    userId,
    tokenHash: hash,
    expiresAt: refreshTokenExpiry(),
    userAgent,
  });
  return { accessToken, refreshToken: raw };
};

export const register = async (
  email: string,
  password: string,
  name: string,
  userAgent = "",
): Promise<AuthResult> => {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw AppError.badRequest("An account with this email already exists");

  // First registered account becomes admin — convenient for bootstrapping.
  const isFirst = (await User.estimatedDocumentCount()) === 0;

  const user = await User.create({
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
    name,
    role: isFirst ? "admin" : "user",
  }).catch((err: unknown) => {
    // Two concurrent sign-ups with the same email: the unique index wins.
    if ((err as { code?: number })?.code === 11000) {
      throw AppError.badRequest("An account with this email already exists");
    }
    throw err;
  });

  const tokens = await issueTokens(user._id.toString(), user.email, user.role, userAgent);
  return { user: toPublicUser(user), ...tokens };
};

export const login = async (
  email: string,
  password: string,
  userAgent = "",
): Promise<AuthResult> => {
  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  // Same error for unknown user and bad password — avoid account enumeration.
  if (!user) throw AppError.unauthorized("Invalid email or password");

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw AppError.unauthorized("Invalid email or password");

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueTokens(user._id.toString(), user.email, user.role, userAgent);
  return { user: toPublicUser(user), ...tokens };
};

/** Rotates a refresh token: validates, revokes the old one, issues a new pair. */
export const refresh = async (rawToken: string, userAgent = ""): Promise<AuthResult> => {
  const tokenHash = hashToken(rawToken);

  // Rotate atomically: only one caller can flip a live token to revoked, so a
  // replayed or concurrently reused refresh token can never mint two sessions.
  const stored = await RefreshToken.findOneAndUpdate(
    { tokenHash, revoked: false, expiresAt: { $gt: new Date() } },
    { $set: { revoked: true } },
  );
  if (!stored) throw AppError.unauthorized("Invalid or expired refresh token");

  const user = await User.findById(stored.userId);
  if (!user) throw AppError.unauthorized("Account no longer exists");

  const tokens = await issueTokens(user._id.toString(), user.email, user.role, userAgent);
  return { user: toPublicUser(user), ...tokens };
};

/** Revokes a single refresh token (logout from this device). */
export const logout = async (rawToken: string): Promise<void> => {
  await RefreshToken.updateOne({ tokenHash: hashToken(rawToken) }, { revoked: true });
};

/** Updates editable profile fields. */
export const updateProfile = async (
  userId: string,
  changes: { name?: string; customInstructions?: string },
): Promise<PublicUser> => {
  const user = await User.findByIdAndUpdate(userId, { $set: changes }, { new: true });
  if (!user) throw AppError.notFound("User not found");
  return toPublicUser(user);
};

/**
 * Changes the password after verifying the current one, then signs out every
 * other session (all refresh tokens revoked) and returns a fresh token pair.
 */
export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
  userAgent = "",
): Promise<AuthResult> => {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw AppError.notFound("User not found");
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw AppError.badRequest("Current password is incorrect");
  }
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  await RefreshToken.updateMany({ userId: user._id, revoked: false }, { $set: { revoked: true } });

  const tokens = await issueTokens(user._id.toString(), user.email, user.role, userAgent);
  return { user: toPublicUser(user), ...tokens };
};

export const getMe = async (userId: string): Promise<PublicUser> => {
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound("User not found");
  return toPublicUser(user);
};
