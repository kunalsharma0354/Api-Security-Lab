import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { metricsService } from "../services/metricsService";

export const API_KEY_HEADER = "X-API-Key";

/**
 * Constant-time comparison of two secret values.
 * Both sides are hashed first so differing lengths cannot leak through
 * timingSafeEqual's length requirement.
 */
function secretsMatch(supplied: string, expected: string): boolean {
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function rejectUnauthorized(res: Response): void {
  metricsService.recordBlocked();
  res.locals.authBlocked = true;
  res.status(401).json({ success: false, error: "Unauthorized" });
}

/**
 * API-key authentication middleware for the authentication lab.
 *
 * - Missing or invalid `X-API-Key` header -> generic `401 Unauthorized`.
 *   The response never reveals whether the key was close to the valid one.
 * - Rejections are classified as blocked requests (not errors) via
 *   `res.locals.authBlocked`, mirroring the rate limiter contract.
 * - The key value itself is never logged or echoed back.
 * - `keyVerifier` optionally accepts additional valid keys (e.g. keys minted
 *   through the issuer at /api/keys) without widening the configured demo
 *   secret itself.
 */
export function createApiKeyAuth(options: {
  apiKey: string;
  keyVerifier?: (candidate: string) => boolean;
}): RequestHandler {
  const expectedKey = options.apiKey;
  const keyVerifier = options.keyVerifier;

  return (req: Request, res: Response, next: NextFunction): void => {
    const supplied = req.get(API_KEY_HEADER);

    if (supplied === undefined || supplied.length === 0) {
      rejectUnauthorized(res);
      return;
    }

    if (!secretsMatch(supplied, expectedKey) && !(keyVerifier?.(supplied) ?? false)) {
      rejectUnauthorized(res);
      return;
    }

    next();
  };
}
