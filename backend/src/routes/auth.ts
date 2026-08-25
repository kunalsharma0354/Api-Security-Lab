import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { RequestHandler } from "express";
import type { AuthResponse } from "../types";

/**
 * Builds the `/api/auth` router.
 *
 * `authHandler` is the configured API-key middleware. When the demo key is
 * missing the lab reports a clear configuration error instead of pretending
 * the protection is active.
 */
export function createAuthRouter(authHandler: RequestHandler): Router {
  const router = Router();

  router.get("/", authHandler, (_req, res) => {
    const body: AuthResponse = {
      success: true,
      message: "Authenticated API request processed",
      protection: "api-key",
      data: {
        endpoint: "/api/auth",
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

/** Fallback used when DEMO_API_KEY is not configured (defensive path). */
export function authNotConfiguredHandler(): RequestHandler {
  return (_req, res) => {
    res.status(503).json({
      success: false,
      error: "Authentication lab not configured on this server",
    });
  };
}
