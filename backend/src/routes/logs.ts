import { Router } from "express";
import { metricsService } from "../services/metricsService";
import type { LogsResponse } from "../types";

export const logsRouter = Router();

logsRouter.get("/", (req, res) => {
  const rawLimit = Number.parseInt(String(req.query.limit ?? ""), 10);
  const limit = Number.isInteger(rawLimit) ? rawLimit : 25;
  const logs = metricsService.getRecentLogs(limit);

  const body: LogsResponse = { success: true, count: logs.length, logs };
  res.set("Cache-Control", "no-store");
  res.json(body);
});
