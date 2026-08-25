export interface RateLimiterHealth {
  active: boolean;
  max: number;
  windowSeconds: number;
}

export interface AuthHealth {
  /** Whether the authentication lab is configured (never exposes the key). */
  active: boolean;
}

export interface HealthResponse {
  status: "ok";
  service: string;
  environment: string;
  timestamp: string;
  rateLimiter: RateLimiterHealth;
  auth: AuthHealth;
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

export interface RequestLogEntry {
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
  logs: RequestLogEntry[];
}

export interface ErrorResponse {
  success: false;
  error: string;
}
