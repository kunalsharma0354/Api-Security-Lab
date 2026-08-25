# Backend — NEXORA API Security Lab

Local Express + TypeScript API for the dashboard.

## Run

```bash
npm install
npm run dev        # http://localhost:3001 (tsx watch)
```

Production-style run:

```bash
npm run build      # tsc -> dist/
npm run start      # node dist/server.js
```

`DEMO_API_KEY` is required: without it the server refuses to start and
prints a clear configuration error (see `.env.example`).

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | `{ status, service, environment, timestamp, rateLimiter, auth }` |
| GET | `/api/demo` | Baseline API, always `200`, `protection: "none"` |
| GET | `/api/rate-limit` | Rate-limited API — 10 req / 60 s per IP (env-configurable) |
| GET | `/api/auth` | API-key protected — requires valid `X-API-Key` header |
| POST | `/api/validate` | Strict input validation — structured per-field 400 errors |
| POST | `/api/payload` | Request size protection — structured 413, byte counts only |
| GET | `/api/timeout` | Timeout protection — slow work cut off with structured 504 |
| GET | `/api/protected` | Multi-layer: dedicated strict shield + API-key auth |
| GET | `/api/metrics` | Live counters from the in-memory metrics service |
| GET | `/api/logs?limit=25` | Most recent recorded requests (max 100) |

## Rate limiting (Part 3)

- Fixed window per client IP (`middleware/rateLimiter.ts`, socket address
  only — `X-Forwarded-For` is deliberately ignored so it cannot be spoofed).
- Success responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining`
  and `X-RateLimit-Reset` (epoch seconds).
- Exceeding the window returns `429` with
  `{ success: false, error: "Rate limit exceeded", retryAfter }` where
  `retryAfter` is derived from the real window and mirrored in the
  `Retry-After` header.
- Blocked requests increment `blockedRequests` via the metrics service and
  are logged with status `429`; they do **not** inflate `errorRequests`.
- `/api/demo` is intentionally left unprotected for side-by-side comparison.
- Configuration comes from `RATE_LIMIT_MAX` and
  `RATE_LIMIT_WINDOW_SECONDS` (validated positive integers) and is reported
  truthfully by `/health`.

## API key authentication (Part 4)

- Only `GET /api/auth` is protected (`middleware/apiKeyAuth.ts`); no other
  route requires a key.
- The header `X-API-Key` is compared against `DEMO_API_KEY` using SHA-256
  hashes + `timingSafeEqual`, so neither length nor timing leaks information.
- Missing and invalid keys receive the identical generic response:
  `401 { success: false, error: "Unauthorized" }` — no hint about how close
  a supplied key was. A valid key returns
  `200 { success:true, message:"Authenticated API request processed",
  protection:"api-key", data:{…} }`.
- Rejections count as **blocked** (`totalRequests` + `blockedRequests`),
  never as errors; they appear in `/api/logs` with status `401` only.
- Key redaction: the value is never stored, returned or printed. Log lines
  for requests that carried the header show `x-api-key=[REDACTED]`.
  `/health` reports `auth.active` without exposing any material; docs use
  the placeholder `X-API-Key: YOUR_API_KEY`.

## Input validation (Part 5)

- `POST /api/validate` accepts `application/json` with exactly
  `{ name, email, age }` (`middleware/inputValidation.ts`).
- Rules: name required text of 2–100 characters (trimmed), email a valid
  address of at most 254 characters, age an integer between 13 and 120.
- Every problem is collected and reported at once:
  `400 { success:false, error:"Validation failed",
  fields:{ field: message } }`.
- Unknown fields are rejected (`Unexpected field "admin"`) instead of being
  silently ignored; arrays and non-object bodies are rejected too.
- Malformed JSON on this route returns the same structured validation error
  via a scoped body parser + `malformedJsonBlocker`; other routes keep the
  global JSON-parser behavior. Middleware order ensures blocked responses
  are still logged and counted by the metrics service.
- Accepted payloads are sanitized (name trimmed) before the handler echoes
  them as `data.received` with `protection: "input-validation"`.
- Rejections count as **blocked**, never as errors; submitted values are
  never written to logs or metrics.

## Request size protection (Part 6)

- `POST /api/payload` accepts JSON bodies up to `PAYLOAD_MAX_KB`
  (default 64 KB).
- Layer 1 (`createContentLengthGuard`): a `Content-Length` above the limit
  gets the structured response before any body byte is read.
- Layer 2: a scoped parser ceiling plus blocker converts body-parser
  `entity.too.large` failures into the same envelope:
  `413 { success:false, error:"Request body too large", limitBytes }`.
- Malformed JSON / non-object bodies on this route get the structured
  validation error. Rejections count as blocked; only byte counts are
  recorded — never contents.

## Timeout protection (Part 7)

- `GET /api/timeout` simulates slow upstream work (3 s) under a deadline
  wrapper configured by `TIMEOUT_MS` (default 2000 ms).
- When the deadline fires first, the client immediately receives
  `504 { success:false, error:"Request timed out", timeoutMs }`; late
  completion is ignored after headers were sent.
- Cut-offs count as blocked and appear in logs with their real latency.

## Multi-layer protection (Part 8)

- `GET /api/protected` stacks layers in DoS-first order:
  `limiter.handler` (dedicated strict instance,
  `PROTECTED_RATE_LIMIT_*`, default 5 / 60 s) runs **before**
  API-key auth — floods of bad keys get `429`, not `401`.
- The shield window is fully isolated from the rate-limit lab instance;
  every attempt consumes shield quota like a real edge shield.
- Success echoes the passed layers:
  `200 { success:true, protection:"multi-layer", layers:["rate-limit","api-key"] }`.

## Behavior notes

- **Request logging** (`middleware/requestLogger.ts`) records method,
  endpoint, status code and latency for every request and prints a line like:
  `2026-08-25T04:40:10Z  GET  /api/demo  200  42ms`
  (plus `x-api-key=[REDACTED]` when the request had an API-key header).
  No passwords, keys, tokens, cookies or bodies are ever logged.
- **Metrics** count only lab traffic — `/health`, `/api/metrics` and
  `/api/logs` are excluded so observability polling does not inflate the
  dashboard numbers. Protection rejections (400/401/413/429/504) land in
  `blockedRequests`, not in `errorRequests`.
- **Errors** are always JSON via `middleware/errorHandler.ts`
  (`{ success: false, error }`), including 404s and malformed JSON bodies.
- **CORS** allows only `FRONTEND_ORIGIN` from `.env`
  (default `http://localhost:5173`).

## Tests

```bash
npm test
```

Runs the `node:test` suite in `tests/api.test.ts` (65 tests): health,
demo payload, metrics shape, counter-delta behavior after real requests,
log recording, JSON 404 and malformed-body handling; rate limiting
(within-limit, exceeded, headers, window reset, isolation); API-key auth
(valid/missing/invalid keys, generic bodies, blocked-not-error metrics,
logs with 401s but no key leak, console `[REDACTED]` capture, demo and
rate-limit isolation, unconfigured-lab behavior); input validation (valid
payloads and echo sanitizing, every rule boundary, multi-error collection,
unknown fields, malformed JSON, metric deltas, log leak checks, endpoint
isolation); request size protection (small/oversized bodies, lying
Content-Length refused via raw sockets, blocked-not-error classification);
timeout protection (structured 504 at the deadline with timing assertions,
blocked-not-error, log entries); multi-layer protection (generic 401s,
layer echo on success, shield 429 with its own window, DoS-first layer
order, metric bucket integrity).
