export interface RateLimiterHealth {
  active: boolean;
  max: number;
  windowSeconds: number;
}

export interface AuthHealth {
  /** Whether the authentication lab is configured (never exposes the key). */
  active: boolean;
}

export interface PayloadHealth {
  active: boolean;
  maxKb: number;
}

export interface TimeoutHealth {
  active: boolean;
  timeoutMs: number;
}

export interface KeysHealth {
  active: boolean;
  max: number;
  windowSeconds: number;
}

export interface HealthResponse {
  status: "ok";
  service: string;
  environment: string;
  timestamp: string;
  rateLimiter: RateLimiterHealth;
  auth: AuthHealth;
  payload: PayloadHealth;
  timeout: TimeoutHealth;
  keys: KeysHealth;
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

export interface PayloadResponse {
  success: true;
  message: string;
  protection: "request-size";
  data: {
    endpoint: string;
    method: string;
    processedAt: string;
    requestId: string;
    sizeBytes: number;
    maxBytes: number;
    fieldsReceived: number;
    keys: string[];
  };
}

/** Structured 413 body — byte counts only, never body contents. */
export interface PayloadTooLargeResponse {
  success: false;
  error: "Request body too large";
  limitBytes: number;
  receivedBytes?: number;
}

export interface TimeoutResponse {
  success: true;
  message: string;
  protection: "timeout";
  data: {
    endpoint: string;
    method: string;
    processedAt: string;
    requestId: string;
    workMs: number;
    timeoutMs: number;
  };
}

export interface TimeoutExceededResponse {
  success: false;
  error: "Request timed out";
  timeoutMs: number;
}

export interface ProtectedResponse {
  success: true;
  message: string;
  protection: "multi-layer";
  layers: string[];
  data: {
    endpoint: string;
    method: string;
    processedAt: string;
    requestId: string;
    layersPassed: string[];
  };
}

/** Creation response — the ONLY place a full key value ever appears. */
export interface KeyCreatedResponse {
  success: true;
  message: string;
  protection: "rate-limit";
  data: {
    endpoint: string;
    method: string;
    processedAt: string;
    requestId: string;
    id: string;
    name: string;
    prefix: string;
    key: string;
    createdAt: string;
    warning: string;
  };
}

export interface ApiKeyMeta {
  id: string;
  prefix: string;
  createdAt: string;
}

export interface KeyListResponse {
  success: true;
  message: string;
  count: number;
  keys: ApiKeyMeta[];
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
