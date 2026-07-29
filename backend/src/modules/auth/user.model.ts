import { Schema, model, type InferSchemaType, type Types } from "mongoose";

/**
 * Application user. `passwordHash` is never selected by default so it can't leak
 * through generic queries — auth lookups opt in explicitly with `.select("+passwordHash")`.
 */
const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },
    emailVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export const User = model("User", userSchema);

/** Shape returned to clients — never includes the hash. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  emailVerified: boolean;
  createdAt: Date;
}

export const toPublicUser = (u: UserDoc): PublicUser => ({
  id: u._id.toString(),
  email: u.email,
  name: u.name,
  role: u.role,
  emailVerified: u.emailVerified,
  createdAt: u.createdAt,
});
