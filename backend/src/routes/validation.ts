import { randomUUID } from "node:crypto";
import { Router } from "express";
import { validateRegistration } from "../middleware/inputValidation";
import type { ValidationResponse } from "../types";

/**
 * POST /api/validate — the only endpoint protected by input validation.
 * The middleware performs the real server-side checks; this handler only
 * runs for payloads that already passed validation.
 */
export const validationRouter = Router();

validationRouter.post("/", validateRegistration, (req, res) => {
  const input = req.body as { name: string; email: string; age: number };
  const body: ValidationResponse = {
    success: true,
    message: "Input validation passed",
    protection: "input-validation",
    data: {
      endpoint: "/api/validate",
      method: "POST",
      processedAt: new Date().toISOString(),
      requestId: randomUUID(),
      received: {
        name: input.name,
        email: input.email,
        age: input.age,
      },
    },
  };
  res.set("Cache-Control", "no-store");
  res.status(200).json(body);
});
