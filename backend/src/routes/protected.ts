import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { ProtectedResponse } from "../types";
import type { RateLimiterInstance } from "../middleware/rateLimiter";
import { createApiKeyAuth } from "../middleware/apiKeyAuth";

/**
 * Multi-layer protected API (Part 8).
 *
 * Layers stack in DoS-first order:
 *   1. dedicated strict rate limiter (own instance — isolated from lab #2)
 *   2. API-key authentication (same timing-safe middleware as lab #3)
 *
 * Every attempt consumes shield quota, even failed key guesses — exactly
 * how a real edge shield behaves.
 */
export function createProtectedRouter(config: {
  limiter: RateLimiterInstance;
  apiKey: string;
}): Router {
  const router = Router();

  router.use(config.limiter.handler);
  router.use(createApiKeyAuth({ apiKey: config.apiKey }));

  router.get("/", (_req, res) => {
    const body: ProtectedResponse = {
      success: true,
      message: "Multi-layer protected request processed",
      protection: "multi-layer",
      layers: ["rate-limit", "api-key"],
      data: {
        endpoint: "/api/protected",
        method: "GET",
        processedAt: new Date().toISOString(),
        requestId: randomUUID(),
        layersPassed: ["rate-limit", "api-key"],
      },
    };
    res.set("Cache-Control", "no-store");
    res.json(body);
  });

  return router;
}
