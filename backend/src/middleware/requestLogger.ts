import type { NextFunction, Request, Response } from "express";
import { metricsService } from "../services/metricsService";

const METRIC_EXCLUDED_PATHS = new Set(["/health", "/api/metrics", "/api/logs"]);

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = performance.now();

  res.on("finish", () => {
    const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
    const entry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      endpoint: req.originalUrl.split("?")[0] ?? req.path,
      statusCode: res.statusCode,
      latencyMs,
    };

    // Security: if the request carried an API key, only a redacted marker
    // is printed — the actual value never reaches logs or the console.
    const keyMarker =
      req.get("X-API-Key") !== undefined ? "\tx-api-key=[REDACTED]" : "";

    console.log(
      `${entry.timestamp}\t${entry.method}\t${entry.endpoint}\t${entry.statusCode}\t${entry.latencyMs}ms${keyMarker}`,
    );

    if (!METRIC_EXCLUDED_PATHS.has(entry.endpoint)) {
      const blocked =
        res.locals.rateLimitBlocked === true ||
        res.locals.authBlocked === true ||
        res.locals.validationBlocked === true;
      metricsService.record({
        ...entry,
        blocked,
      });
    }
  });

  next();
}
