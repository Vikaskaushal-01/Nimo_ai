import { Router } from "express";
import { overviewHandler } from "./analytics.controller.js";

export const analyticsRouter = Router();

analyticsRouter.get("/analytics/overview", overviewHandler);
