import type { NextFunction, Request, RequestHandler, Response } from "express";
import { metricsService } from "../services/metricsService";

/**
 * Request-size protection (Part 6).
 *
 * Two layers of defense for POST bodies:
 *  1. `createContentLengthGuard(limitBytes)` — rejects requests up front,
 *     before a single body byte is read, when the Content-Length header
 *     already exceeds the configured maximum.
 *  2. `createPayloadBlocker(limitBytes)` — error handler placed right after
 *     the scoped body parser: turns body-parser failures into the lab's
 *     structured envelope instead of a generic HTML/stack error.
 *
 * Rejected payloads count as **blocked** (never errors) and submitted
 * contents are never logged — only byte counts are.
 */

/** Hard ceiling for the scoped JSON parser: declared limit + headroom. */
export function parserCeilingFor(limitBytes: number): string {
  return `${limitBytes + 64 * 1024}b`;
}

export function createContentLengthGuard(
  limitBytes: number,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const declared = Number(req.headers["content-length"]);
    if (Number.isFinite(declared) && declared > limitBytes) {
      rejectTooLarge(res, limitBytes, declared);
      return;
    }
    next();
  };
}

export function rejectTooLarge(
  res: Response,
  limitBytes: number,
  receivedBytes: number | null,
): void {
  // Same protection contract as rate-limit/auth/validation:
  // mark the response so requestLogger classifies it as blocked.
  res.locals.payloadBlocked = true;
  metricsService.recordBlocked();

  res.status(413).json({
    success: false,
    error: "Request body too large",
    limitBytes,
    ...(receivedBytes !== null ? { receivedBytes } : {}),
  });
}

type BodyParserError = Error & {
  statusCode?: number;
  type?: string;
};

/**
 * Scoped error handler for the payload route: converts body-parser
 * failures (oversized entity, malformed JSON) into structured responses.
 */
export function createPayloadBlocker(limitBytes: number) {
  return (
    err: BodyParserError,
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    if (err.type === "entity.too.large" || err.statusCode === 413) {
      rejectTooLarge(res, limitBytes, null);
      return;
    }
    if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
      res.locals.payloadBlocked = true;
      metricsService.recordBlocked();
      res.status(400).json({
        success: false,
        error: "Validation failed",
        fields: { body: "Request body must be valid JSON" },
      });
      return;
    }
    next(err);
  };
}
