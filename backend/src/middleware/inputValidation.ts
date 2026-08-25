import type { NextFunction, Request, RequestHandler, Response } from "express";
import { metricsService } from "../services/metricsService";

export interface RegistrationInput {
  name: string;
  email: string;
  age: number;
}

const NAME_MIN = 2;
const NAME_MAX = 100;
const EMAIL_MAX = 254;
const AGE_MIN = 13;
const AGE_MAX = 120;

/**
 * Deliberately simple "reasonable email" check for the lab:
 * one @, no whitespace, and a dot-separated domain with a 2+ char TLD.
 */
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

type FieldErrors = Record<string, string>;

function rejectValidation(res: Response, fields: FieldErrors): void {
  metricsService.recordBlocked();
  res.locals.validationBlocked = true;
  res.status(400).json({
    success: false,
    error: "Validation failed",
    fields,
  });
}

/**
 * Scoped JSON-parse error handler for `/api/validate`. Malformed bodies are
 * treated like any other rejected input: a clean structured 400 counted as
 * blocked — no stack traces, no raw parser errors.
 */
export function malformedJsonBlocker(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  const candidate = err as { type?: string } | null;
  const isParseError =
    err instanceof SyntaxError && "body" in err ||
    candidate?.type === "entity.parse.failed";
  if (!isParseError) {
    next(err);
    return;
  }
  rejectValidation(res, {
    body: "Request body must be valid JSON",
  });
}

/**
 * Server-side validation middleware for the input-validation lab.
 *
 * The backend is the source of truth: it re-checks everything the frontend
 * might have checked. All problems are collected (not fail-fast) so the
 * learner can see every rejected field at once. On success the sanitized
 * values (e.g. trimmed name) replace `req.body` before the route runs.
 *
 * Rejections follow the shared protection contract: blocked (not errors)
 * via `res.locals.validationBlocked`, mirroring rateLimiter/apiKeyAuth.
 */
export const validateRegistration: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const body: unknown = req.body;

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    rejectValidation(res, {
      body: "Request body must be a JSON object",
    });
    return;
  }

  const raw = body as Record<string, unknown>;
  const fields: FieldErrors = {};

  // Unknown fields are rejected, not ignored silently.
  for (const key of Object.keys(raw)) {
    if (key !== "name" && key !== "email" && key !== "age") {
      fields[key] = `Unexpected field "${key}"`;
    }
  }

  // name — required string, trimmed, 2..100 chars
  const nameValue = raw.name;
  if (nameValue === undefined) {
    fields.name = "Name is required";
  } else if (typeof nameValue !== "string") {
    fields.name = "Name must be a string";
  } else {
    const trimmed = nameValue.trim();
    if (trimmed.length < NAME_MIN) {
      fields.name = `Name must be at least ${NAME_MIN} characters`;
    } else if (trimmed.length > NAME_MAX) {
      fields.name = `Name must be at most ${NAME_MAX} characters`;
    }
  }

  // email — required string, reasonable format, max 254 chars
  const emailValue = raw.email;
  if (emailValue === undefined) {
    fields.email = "Email is required";
  } else if (typeof emailValue !== "string") {
    fields.email = "Email must be a string";
  } else {
    if (emailValue.length > EMAIL_MAX) {
      fields.email = `Email must be at most ${EMAIL_MAX} characters`;
    } else if (!EMAIL_PATTERN.test(emailValue)) {
      fields.email = "Invalid email format";
    }
  }

  // age — required integer, 13..120
  const ageValue = raw.age;
  if (ageValue === undefined) {
    fields.age = "Age is required";
  } else if (typeof ageValue !== "number" || !Number.isInteger(ageValue)) {
    fields.age = "Age must be an integer";
  } else if (ageValue < AGE_MIN) {
    fields.age = `Age must be at least ${AGE_MIN}`;
  } else if (ageValue > AGE_MAX) {
    fields.age = `Age must be at most ${AGE_MAX}`;
  }

  if (Object.keys(fields).length > 0) {
    rejectValidation(res, fields);
    return;
  }

  // Sanitized payload replaces the raw body for the route handler.
  req.body = {
    name: (raw.name as string).trim(),
    email: raw.email as string,
    age: raw.age as number,
  } satisfies RegistrationInput;

  next();
};
