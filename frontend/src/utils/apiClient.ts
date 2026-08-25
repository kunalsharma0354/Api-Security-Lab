import type {
  ApiEnvelope,
  AuthResponse,
  DemoResponse,
  HealthInfo,
  KeyCreatedResponse,
  KeyListResponse,
  LogsResponse,
  MetricsSnapshot,
  PayloadResponse,
  ProtectedResponse,
  RateLimitInfo,
  RateLimitResponse,
  TimeoutResponse,
  ValidationResponse,
} from "../types";

const DEFAULT_LOCAL_API = "http://localhost:3001";
const DEFAULT_DEPLOYED_API = "https://nexoralabbackend.vercel.app";

/**
 * API base URL resolution:
 * 1. Explicit VITE_API_BASE_URL always wins (set it in Vercel env vars to
 *    point the deployed frontend at any backend).
 * 2. `vite dev` (import.meta.env.DEV) talks to the local backend.
 * 3. A production build defaults to the deployed NEXORA backend.
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? DEFAULT_LOCAL_API : DEFAULT_DEPLOYED_API);

export const BACKEND_OFFLINE_MESSAGE =
  "Unable to connect to NEXORA API backend.\nMake sure the backend server is running on port 3001.";

const REQUEST_TIMEOUT_MS = 10_000;

export class ApiRequestError extends Error {
  readonly statusCode: number | null;
  readonly retryAfterSeconds: number | null;
  readonly rateLimitInfo?: RateLimitInfo;
  /** Structured validation errors (400 responses from /api/validate). */
  readonly fields?: Record<string, string>;
  /** Byte limit reported by structured 413 responses. */
  readonly limitBytes?: number;
  /** Byte count received, when the backend reports it. */
  readonly receivedBytes?: number;
  /** Deadline reported by structured 504 responses. */
  readonly timeoutMs?: number;

  constructor(
    message: string,
    statusCode: number | null = null,
    extra: {
      retryAfterSeconds?: number | null;
      rateLimitInfo?: RateLimitInfo;
      fields?: Record<string, string>;
      limitBytes?: number;
      receivedBytes?: number;
      timeoutMs?: number;
    } = {},
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.statusCode = statusCode;
    this.retryAfterSeconds = extra.retryAfterSeconds ?? null;
    this.rateLimitInfo = extra.rateLimitInfo;
    this.fields = extra.fields;
    this.limitBytes = extra.limitBytes;
    this.receivedBytes = extra.receivedBytes;
    this.timeoutMs = extra.timeoutMs;
  }
}

function parseRateLimitHeaders(headers: Headers): RateLimitInfo | undefined {
  const limit = headers.get("X-RateLimit-Limit");
  const remaining = headers.get("X-RateLimit-Remaining");
  const reset = headers.get("X-RateLimit-Reset");
  if (limit === null && remaining === null && reset === null) return undefined;

  const toNullableNumber = (value: string | null): number | null => {
    if (value === null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    limit: toNullableNumber(limit),
    remaining: toNullableNumber(remaining),
    resetAtEpochSec: toNullableNumber(reset),
  };
}

async function request<T>(
  path: string,
  extraHeaders: Record<string, string> = {},
  init: { method?: string; body?: string } = {},
): Promise<ApiEnvelope<T>> {
  const startedAt = performance.now();

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: init.method ?? "GET",
      headers: { Accept: "application/json", ...extraHeaders },
      body: init.body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new ApiRequestError(
        `The request to ${path} timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`,
        null,
      );
    }
    throw new ApiRequestError(BACKEND_OFFLINE_MESSAGE, null);
  }

  const latencyMs = Math.round(performance.now() - startedAt);
  const rateLimit = parseRateLimitHeaders(response.headers);

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      (body as { error?: string } | null)?.error ??
      `Request failed with HTTP status ${response.status}.`;

    const retryAfterRaw = response.headers.get("Retry-After");
    const retryAfterSeconds =
      body !== null &&
      typeof body === "object" &&
      typeof (body as { retryAfter?: unknown }).retryAfter === "number"
        ? ((body as { retryAfter: number }).retryAfter)
        : Number.isFinite(Number(retryAfterRaw))
          ? Number(retryAfterRaw)
          : null;

    // Structured validation errors: keep the per-field map for the UI.
    let fields: Record<string, string> | undefined;
    if (body !== null && typeof body === "object") {
      const rawFields = (body as { fields?: unknown }).fields;
      if (rawFields !== null && typeof rawFields === "object" && !Array.isArray(rawFields)) {
        const entries = Object.entries(rawFields as Record<string, unknown>).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        );
        if (entries.length > 0) {
          fields = Object.fromEntries(entries);
        }
      }
    }

    // Structured 413 / 504 payloads carry their protection parameters.
    const numeric = (value: unknown): number | undefined =>
      typeof value === "number" && Number.isFinite(value) ? value : undefined;
    const limitBytes = numeric((body as { limitBytes?: unknown } | null)?.limitBytes);
    const receivedBytes = numeric((body as { receivedBytes?: unknown } | null)?.receivedBytes);
    const timeoutMs = numeric((body as { timeoutMs?: unknown } | null)?.timeoutMs);

    throw new ApiRequestError(message, response.status, {
      retryAfterSeconds,
      rateLimitInfo: rateLimit,
      fields,
      limitBytes,
      receivedBytes,
      timeoutMs,
    });
  }

  return { status: response.status, latencyMs, data: body as T, rateLimit };
}

export const api = {
  health: () => request<HealthInfo>("/health"),
  demo: () => request<DemoResponse>("/api/demo"),
  rateLimit: () => request<RateLimitResponse>("/api/rate-limit"),
  /**
   * API-key lab. Pass the user-supplied key (or null to omit the header).
   * The key lives only in this request — it is never persisted or logged.
   */
  auth: (apiKey: string | null) =>
    request<AuthResponse>(
      "/api/auth",
      apiKey ? { "X-API-Key": apiKey } : {},
    ),
  /**
   * Input-validation lab. Sends the raw JSON text exactly as typed so the
   * backend performs the real server-side validation.
   */
  validate: (jsonBody: string) =>
    request<ValidationResponse>(
      "/api/validate",
      { "Content-Type": "application/json" },
      { method: "POST", body: jsonBody },
    ),
  /**
   * Request-size lab. Sends the raw JSON text exactly as typed — oversized
   * payloads get a structured 413 from the backend.
   */
  payload: (jsonBody: string) =>
    request<PayloadResponse>(
      "/api/payload",
      { "Content-Type": "application/json" },
      { method: "POST", body: jsonBody },
    ),
  /**
   * Timeout lab. The backend deliberately works slower than its deadline
   * and cuts the request off with a structured 504.
   */
  timeout: () => request<TimeoutResponse>("/api/timeout"),
  /** Multi-layer lab: strict shield + API-key auth stacked on one route. */
  protectedApi: (apiKey: string | null) =>
    request<ProtectedResponse>(
      "/api/protected",
      apiKey ? { "X-API-Key": apiKey } : {},
    ),
  /**
   * Key issuer. Unlimited keys over time, but issuance itself is throttled
   * (10 per 5 minutes by default) — the X-RateLimit headers on the envelope
   * show the remaining quota for this window.
   */
  createKey: () =>
    request<KeyCreatedResponse>("/api/keys", {}, { method: "POST" }),
  /** Metadata list of issued keys — full values are never returned here. */
  listKeys: () => request<KeyListResponse>("/api/keys"),
  metrics: () => request<MetricsSnapshot>("/api/metrics"),
  logs: (limit = 25) => request<LogsResponse>(`/api/logs?limit=${limit}`),
};
