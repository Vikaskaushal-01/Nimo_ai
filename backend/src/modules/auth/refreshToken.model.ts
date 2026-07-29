import { Schema, model, type InferSchemaType, type Types } from "mongoose";

/**
 * Stored refresh tokens (hashed). Supports rotation (a refreshed token marks its
 * predecessor `revoked`) and absolute expiry. The TTL index lets MongoDB reap
 * expired documents automatically.
 */
const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true },
);

// Auto-expire documents once past `expiresAt`.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenDoc = InferSchemaType<typeof refreshTokenSchema> & {
  _id: Types.ObjectId;
};
export const RefreshToken = model("RefreshToken", refreshTokenSchema);
