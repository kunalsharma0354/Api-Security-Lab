/** Shared domain types for the NEXORA dashboard.
 *  Part 1: UI-only placeholders. Real request/log types arrive with the backend in Part 2.
 */

export type HttpMethod = "GET" | "POST";

export type Tone = "ready" | "off" | "neutral" | "protection" | "warning";

export interface ApiLab {
  id: string;
  order: number;
  name: string;
  description: string;
  statusLabel: string;
  statusTone: Tone;
  method: HttpMethod;
  endpoint: string;
  protection?: string;
}

export interface StatItem {
  id: string;
  label: string;
  value: string;
  unit?: string;
  hint: string;
  icon: IconName;
  tone: "accent" | "success" | "warning" | "danger" | "info" | "default";
}

export interface ServiceStatus {
  id: string;
  name: string;
  detail: string;
  state: "waiting" | "idle" | "online";
}

export interface LogEntry {
  id: string;
  time: string;
  method: HttpMethod;
  endpoint: string;
  statusCode: number | null;
  latencyMs: number | null;
}

export type IconName =
  | "dashboard"
  | "flask"
  | "logs"
  | "analytics"
  | "book"
  | "settings"
  | "shield"
  | "bolt"
  | "check"
  | "block"
  | "alert"
  | "timer"
  | "server"
  | "info";

/* ---------- Backend contracts (Part 2) ---------- */

export interface RateLimiterHealth {
  active: boolean;
  max: number;
  windowSeconds: number;
}

export interface AuthHealth {
  /** Whether the backend authentication lab is configured (never the key). */
  active: boolean;
}

export interface HealthInfo {
  status: "ok";
  service: string;
  environment: string;
  timestamp: string;
  rateLimiter: RateLimiterHealth;
  auth?: AuthHealth;
}

export interface DemoResponse {
  success: true;
  message: string;
  protection: "none";
  data: {
    endpoint: string;
    method: string;
    processedAt: string;
    requestId: string;
  };
}

export interface RateLimitResponse {
  success: true;
  message: string;
  protection: "rate-limit";
  data: {
    endpoint: string;
    method: string;
    processedAt: string;
    requestId: string;
  };
}

export interface RateLimitExceededResponse {
  success: false;
  error: string;
  retryAfter: number;
}

export interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
  /** X-RateLimit-Reset value (epoch seconds). */
  resetAtEpochSec: number | null;
}

export interface AuthResponse {
  success: true;
  message: string;
  protection: "api-key";
  data: {
    endpoint: string;
    method: string;
    processedAt: string;
    requestId: string;
  };
}

export interface UnauthorizedResponse {
  success: false;
  error: "Unauthorized";
}

export interface ValidationResponse {
  success: true;
  message: string;
  protection: "input-validation";
  data: {
    endpoint: string;
    method: string;
    processedAt: string;
    requestId: string;
    received: {
      name: string;
      email: string;
      age: number;
    };
  };
}

/** Structured 400 body — one entry per rejected field. */
export interface ValidationErrorResponse {
  success: false;
  error: "Validation failed";
  fields: Record<string, string>;
}

export interface MetricsSnapshot {
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  blockedRequests: number;
  averageLatency: number;
}

export interface BackendLogRecord {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  statusCode: number;
  latencyMs: number;
}

export interface LogsResponse {
  success: true;
  count: number;
  logs: BackendLogRecord[];
}

export interface ApiEnvelope<T> {
  status: number;
  latencyMs: number;
  data: T;
  rateLimit?: RateLimitInfo;
}

export type LabRequestOutcome =
  | {
      kind: "success";
      httpStatus: number;
      latencyMs: number;
      message: string;
      payload?: unknown;
      rateLimit?: RateLimitInfo;
    }
  | {
      kind: "limited";
      httpStatus: number;
      latencyMs: number | null;
      message: string;
      retryAfterSeconds: number | null;
      rateLimit?: RateLimitInfo;
    }
  | {
      kind: "unauthorized";
      httpStatus: number;
      latencyMs: number | null;
      message: string;
      /** Derived locally: no key typed vs a key that was rejected. */
      reason: "missing" | "invalid";
    }
  | {
      kind: "invalid";
      httpStatus: number;
      latencyMs: number | null;
      message: string;
      /** One entry per rejected field, straight from the backend. */
      fields: Record<string, string>;
    }
  | {
      kind: "error";
      httpStatus: number | null;
      latencyMs: number | null;
      message: string;
    };
