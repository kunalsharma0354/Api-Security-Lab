import { Router } from "express";
import { metricsService } from "../services/metricsService";

export const metricsRouter = Router();

metricsRouter.get("/", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(metricsService.getSnapshot());
});
