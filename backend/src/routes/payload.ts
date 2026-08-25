import { randomUUID } from "node:crypto";
import { Router, json } from "express";
import type { Request, Response } from "express";
import type { PayloadResponse } from "../types";
import {
  createContentLengthGuard,
  createPayloadBlocker,
  parserCeilingFor,
} from "../middleware/payloadGuard";
import { metricsService } from "../services/metricsService";

export function createPayloadRouter(maxBytes: number): Router {
  const router = Router();

  // Layer 1: refuse early when Content-Length already exceeds the limit —
  // the body is never read in that case.
  router.use(createContentLengthGuard(maxBytes));

  // Layer 2: scoped parser (wins over the global one for this route) with a
  // hard ceiling; its failures are converted by the blocker below.
  router.use(json({ limit: parserCeilingFor(maxBytes) }));
  router.use(createPayloadBlocker(maxBytes));

  router.post("/", (req: Request, res: Response) => {
    const body = req.body as unknown;

    // Defense in depth: even if the parser passed, enforce the exact limit
    // on what actually arrived.
    const receivedBytes =
      typeof req.headers["content-length"] === "string"
        ? Number(req.headers["content-length"])
        : null;
    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      (receivedBytes !== null && receivedBytes > maxBytes)
    ) {
      res.locals.payloadBlocked = true;
      metricsService.recordBlocked();
      res.status(400).json({
        success: false,
        error: "Validation failed",
        fields: { body: "Request body must be a JSON object" },
      });
      return;
    }

    const keys = Object.keys(body as Record<string, unknown>);
    const response: PayloadResponse = {
      success: true,
      message: "Payload accepted",
      protection: "request-size",
      data: {
        endpoint: "/api/payload",
        method: "POST",
        processedAt: new Date().toISOString(),
        requestId: randomUUID(),
        sizeBytes: receivedBytes ?? 0,
        maxBytes,
        fieldsReceived: keys.length,
        keys,
      },
    };
    res.json(response);
  });

  return router;
}
