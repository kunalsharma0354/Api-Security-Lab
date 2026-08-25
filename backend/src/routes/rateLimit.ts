import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { RateLimiterInstance } from "../middleware/rateLimiter";
import type { RateLimitResponse } from "../types";

export function createRateLimitRouter(limiter: RateLimiterInstance): Router {
  const router = Router();

  router.get("/", limiter.handler, (_req, res) => {
    const body: RateLimitResponse = {
      success: true,
      message: "Rate-limited API request processed",
      protection: "rate-limit",
      data: {
        endpoint: "/api/rate-limit",
        method: "GET",
        processedAt: new Date().toISOString(),
        requestId: randomUUID(),
      },
    };
    res.set("Cache-Control", "no-store");
    res.status(200).json(body);
  });

  return router;
}
