import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Request, Response } from "express";
import type {
  KeyCreatedResponse,
  KeyListResponse,
} from "../types";
import type { RateLimiterInstance } from "../middleware/rateLimiter";
import { keysService } from "../services/keysService";

/**
 * API-key issuer (Part 9).
 *
 * - `POST /api/keys` mints a key — unlimited total, but issuance runs
 *   through a dedicated limiter (10 per 5 minutes by default), so hammering
 *   the endpoint gets the standard structured 429.
 * - `GET /api/keys` lists metadata only (prefix + timestamps); full values
 *   were shown exactly once at creation and are never stored.
 */
export function createKeysRouter(config: { limiter: RateLimiterInstance }): Router {
  const router = Router();

  router.post("/", config.limiter.handler, (_req: Request, res: Response) => {
    const issued = keysService.issue();
    const body: KeyCreatedResponse = {
      success: true,
      message: "API key created",
      protection: "rate-limit",
      data: {
        endpoint: "/api/keys",
        method: "POST",
        processedAt: new Date().toISOString(),
        requestId: randomUUID(),
        id: issued.id,
        name: issued.prefix,
        prefix: issued.prefix,
        key: issued.key,
        createdAt: issued.createdAt,
        warning:
          "Copy this key now — it will not be shown again.",
      },
    };
    res.set("Cache-Control", "no-store");
    res.status(201).json(body);
  });

  router.get("/", (_req: Request, res: Response) => {
    const keys = keysService.list();
    const body: KeyListResponse = {
      success: true,
      message: "API key metadata",
      count: keys.length,
      keys,
    };
    res.set("Cache-Control", "no-store");
    res.json(body);
  });

  return router;
}
