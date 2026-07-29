import { z } from "zod";
import { ok } from "../../shared/ApiResponse.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { currentUser } from "../../middleware/auth.js";
import { buildOverview } from "./analytics.service.js";

export const overviewQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export const overviewHandler = asyncHandler(async (req, res) => {
  const { days } = overviewQuerySchema.parse(req.query);
  const overview = await buildOverview(currentUser(req).sub, days ?? 30);
  ok(res, overview);
});
