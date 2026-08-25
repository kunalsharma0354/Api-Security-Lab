import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { TimeoutResponse, TimeoutExceededResponse } from "../types";
import { metricsService } from "../services/metricsService";

/** Simulated "slow upstream work" — deliberately longer than the default
 * TIMEOUT_MS so a plain request demonstrates the cut-off. */
export const SIMULATED_WORK_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps a slow handler with a hard deadline. When the deadline fires first
 * the response becomes the structured 504 and the slow work's eventual
 * completion is ignored (headers already sent). Counts as blocked, like
 * every other protection action.
 */
export function createTimeoutWrapper(timeoutMs: number): (
  handler: (req: Request, res: Response) => Promise<void> | void,
) => RequestHandler {
  return (handler) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        res.locals.timeoutBlocked = true;
        metricsService.recordBlocked();
        const body: TimeoutExceededResponse = {
          success: false,
          error: "Request timed out",
          timeoutMs,
        };
        res.status(504).json(body);
      }, timeoutMs);

      try {
        await handler(req, res);
        // The handler finished inside the window — cancel the cut-off.
        clearTimeout(timer);
        if (!timedOut && !res.headersSent) {
          // Handler is responsible for its own response; nothing to do here.
        }
      } catch (err) {
        clearTimeout(timer);
        if (!timedOut) next(err);
      }
    };
  };
}

export function createTimeoutRouter(timeoutMs: number): Router {
  const router = Router();
  const withTimeout = createTimeoutWrapper(timeoutMs);

  router.get(
    "/",
    withTimeout(async (_req, res) => {
      await sleep(SIMULATED_WORK_MS);
      if (res.headersSent) return;
      const body: TimeoutResponse = {
        success: true,
        message: "Slow request completed",
        protection: "timeout",
        data: {
          endpoint: "/api/timeout",
          method: "GET",
          processedAt: new Date().toISOString(),
          requestId: randomUUID(),
          workMs: SIMULATED_WORK_MS,
          timeoutMs,
        },
      };
      res.json(body);
    }),
  );

  return router;
}
