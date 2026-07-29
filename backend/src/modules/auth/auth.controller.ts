import { z } from "zod";
import { ok } from "../../shared/ApiResponse.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { currentUser } from "../../middleware/auth.js";
import { AppError } from "../../shared/AppError.js";
import * as auth from "./auth.service.js";

export const registerSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  name: z.string().trim().min(1).max(80),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const agent = (ua?: string) => (ua ?? "").slice(0, 200);

export const registerHandler = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body as z.infer<typeof registerSchema>;
  const result = await auth.register(email, password, name, agent(req.header("user-agent")));
  ok(res, result, 201);
});

export const loginHandler = asyncHandler(async (req, res) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>;
  const result = await auth.login(email, password, agent(req.header("user-agent")));
  ok(res, result);
});

export const refreshHandler = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
  const result = await auth.refresh(refreshToken, agent(req.header("user-agent")));
  ok(res, result);
});

export const logoutHandler = asyncHandler(async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest("refreshToken is required");
  await auth.logout(parsed.data.refreshToken);
  ok(res, { loggedOut: true });
});

export const meHandler = asyncHandler(async (req, res) => {
  const user = await auth.getMe(currentUser(req).sub);
  ok(res, user);
});
