import type { NextFunction, Request, Response } from "express";
import type { ErrorResponse } from "../types";
import { env } from "../config/env";

interface ErrorWithStatus {
  status?: number;
  statusCode?: number;
  type?: string;
  message?: string;
}

function resolveStatusCode(err: unknown): number {
  const candidate = err as ErrorWithStatus;
  const status =
    typeof candidate?.status === "number"
      ? candidate.status
      : typeof candidate?.statusCode === "number"
        ? candidate.statusCode
        : 500;
  return status >= 400 && status <= 599 ? status : 500;
}

export function notFoundHandler(req: Request, res: Response): void {
  const body: ErrorResponse = {
    success: false,
    error: `Not found: ${req.method} ${req.path}`,
  };
  res.status(404).json(body);
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = resolveStatusCode(err);
  let message = "Internal server error";
  let detail: string | undefined;

  if (err instanceof SyntaxError && "body" in err) {
    statusCode = 400;
    message = "Malformed JSON request body";
    detail = err.message;
  } else if (err instanceof Error) {
    detail = err.message;
    if (statusCode === 413) message = "Request body too large";
    if ((err as ErrorWithStatus).type === "entity.parse.failed") {
      statusCode = 400;
      message = "Malformed JSON request body";
    }
  }

  if (statusCode >= 500) {
    console.error(
      `[error] ${req.method} ${req.originalUrl} ->`,
      err instanceof Error ? (err.stack ?? err.message) : err,
    );
  }

  const body: ErrorResponse = { success: false, error: message };
  if (env.isDevelopment && detail && statusCode >= 500) {
    res.status(statusCode).json({ ...body, detail });
    return;
  }
  res.status(statusCode).json(body);
}
