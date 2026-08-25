import type { NextFunction, Request, RequestHandler, Response } from "express";
import { metricsService } from "../services/metricsService";

export interface RateLimiterOptions {
  /** Maximum requests allowed per identifier inside one window. */
  max: number;
  /** Fixed window length in milliseconds. */
  windowMs: number;
}

interface WindowState {
  count: number;
  windowStart: number;
  resetAt: number;
}

export interface RateLimiterInstance {
  options: RateLimiterOptions;
  handler: RequestHandler;
  /** Clears all tracked windows (used by the test-suite for isolation). */
  reset(): void;
}

const MAX_TRACKED_IDENTIFIERS = 5000;

/**
 * Identifies the calling client. Uses the socket address only —
 * proxy headers such as X-Forwarded-For are deliberately ignored so
 * the identifier cannot be spoofed in this lab.
 */
export function clientIdentifier(req: Request): string {
  const raw = req.socket.remoteAddress ?? "unknown";
  if (raw === "::1" || raw === "::ffff:127.0.0.1") return "127.0.0.1";
  return raw;
}

/**
 * In-memory fixed-window rate limiter.
 *
 * Tracks per identifier: request count, window start and window reset time.
 * Blocked responses mark `res.locals.rateLimitBlocked` so the request
 * logger can classify them as blocked (not generic errors) in metrics.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiterInstance {
  const windows = new Map<string, WindowState>();

  function pruneExpired(now: number): void {
    if (windows.size < MAX_TRACKED_IDENTIFIERS) return;
    for (const [key, state] of windows) {
      if (now >= state.resetAt) windows.delete(key);
    }
  }

  const handler: RequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const identifier = clientIdentifier(req);
    const now = Date.now();

    pruneExpired(now);

    let window = windows.get(identifier);
    if (window === undefined || now >= window.resetAt) {
      window = { count: 0, windowStart: now, resetAt: now + options.windowMs };
      windows.set(identifier, window);
    }

    window.count += 1;

    const remaining = Math.max(0, options.max - window.count);
    res.setHeader("X-RateLimit-Limit", String(options.max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(window.resetAt / 1000)));

    if (window.count > options.max) {
      metricsService.recordBlocked();
      res.locals.rateLimitBlocked = true;

      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((window.resetAt - now) / 1000),
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));

      res.status(429).json({
        success: false,
        error: "Rate limit exceeded",
        retryAfter: retryAfterSeconds,
      });
      return;
    }

    next();
  };

  return {
    options,
    handler,
    reset() {
      windows.clear();
    },
  };
}
