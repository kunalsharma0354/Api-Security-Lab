# Architecture Notes

## Overview

```text
┌──────────────────────────────┐          ┌─────────────────────────────────┐
│  frontend (React + Vite)     │   HTTP   │  backend (Express, port 3001)   │
│                              │ ───────► │                                 │
│  utils/apiClient.ts          │  JSON    │  routes/ health · demo ·        │
│  hooks/useServicesHealth     │ ◄─────── │    auth · rate-limit ·          │
│  hooks/useLabRunner          │          │    validate · metrics · logs    │
│  components/pages            │          │  middleware/ requestLogger ·    │
└──────────────────────────────┘          │    errorHandler · rateLimiter · │
                                          │    apiKeyAuth ·                 │
                                          │    inputValidation              │
                                          │  services/ metricsService       │
                                          │  config/ env (dotenv)           │
                                          └─────────────────────────────────┘
```

## Data flow (Part 3)

1. `ServicesHealthProvider` polls `GET /health` every 20s → drives the
   header pill, the API Status panel (including the real Rate Limiter
   `Active · max/window` row) and the lab cards' limit labels.
2. Pressing **SEND REQUEST** on a wired card calls `useLabRunner.runLab` →
   the matching typed caller (timeout + friendly offline error). Outcomes
   are classified as success, limited (`429`, with retryAfter and parsed
   `X-RateLimit-*` headers) or error — 429 is never treated as a crash.
3. The Rate Limited card additionally exposes a controlled burst action:
   exactly N sequential requests via `runBurst` (capped at 10), summarizing
   passed/blocked counts. No unlimited loops exist anywhere.
4. On settle, pages refetch `GET /api/metrics` and `GET /api/logs?limit=n`
   so stat cards and the activity table show real backend state.
5. Backend: `rateLimiter` middleware implements a fixed window per client
   IP (socket address only — proxy headers ignored). It stamps
   `X-RateLimit-*` headers; on excess it calls `metricsService.recordBlocked()`,
   sets `res.locals.rateLimitBlocked = true`, and answers `429` with a
   window-derived `retryAfter` + `Retry-After`.
6. `requestLogger` measures latency for every request, prints a structured
   console line, and records into metrics with the blocked flag — so blocked
   requests count in `totalRequests`/`blockedRequests` but not in
   `successfulRequests`/`errorRequests`. Observability paths
   (`/health`, `/api/metrics`, `/api/logs`) stay excluded from metrics.

## Data flow (Part 4)

1. `ServicesHealthProvider` polls `GET /health` every 20s → drives the
   header pill, the API Status panel (Rate Limiter row and the new
   "API Key Authentication · Active" row) and lab-card limit labels.
2. Pressing **SEND REQUEST** on a wired card calls `useLabRunner.runLab` →
   the matching typed caller. Outcomes are classified as success, limited
   (`429`), unauthorized (`401`) or error — protection responses are never
   treated as crashes.
3. The auth card owns a local API-key input; its value is passed per call
   (`api.auth(key|null)`), lives only in React state, is never persisted,
   logged or echoed. Missing vs invalid keys are distinguished client-side
   for the educational message only — the backend response stays identical.
4. On settle, pages refetch `GET /api/metrics` and `GET /api/logs?limit=n`
   so stat cards and the activity table show real backend state.
5. Backend auth: `createApiKeyAuth({apiKey})` compares the supplied
   `X-API-Key` header against the configured demo key using SHA-256 hashes
   + `timingSafeEqual` (no length or timing leak). Rejections call
   `metricsService.recordBlocked()` and set `res.locals.authBlocked`.
6. Classification contract: both protection middlewares mark
   `res.locals.{rateLimitBlocked|authBlocked}`; the requestLogger records
   those as blocked (total/blocked counters) while successful/other
   requests keep their usual buckets. 401 log lines append
   `x-api-key=[REDACTED]`; no key value ever reaches storage.
7. Startup safety: `server.ts` refuses to boot when `DEMO_API_KEY` is unset
   (the auth lab would otherwise silently run disabled); `/health` reports
   `auth.active` truthfully without exposing the key itself.

## Data flow (Part 5)

1. The validation card owns a local JSON editor (`validateBody` state) with
   safe one-click presets that replace the editor contents only — nothing
   is sent until the user presses SEND REQUEST. A frontend `JSON.parse`
   guard gives instant "Invalid JSON" feedback, but the backend always
   re-validates everything server-side.
2. Sending calls `api.validate(bodyText)` — a real `POST /api/validate`
   with `Content-Type: application/json`, so the backend performs genuine
   validation on exactly what was typed.
3. Backend middleware chain order matters: `requestLogger` runs first
   (so blocked attempts are still logged/counted), then a scoped
   `express.json` + `malformedJsonBlocker` for `/api/validate` wins over
   the global parser (`req._body` prevents double parsing), then routes.
4. `validateRegistration` collects every problem at once and rejects with
   `400 { success:false, error:"Validation failed", fields:{…} }`;
   unknown fields are rejected explicitly. Accepted payloads are sanitized
   (name trimmed) before echoing as `data.received`.
5. The runner classifies structured 400s as an `invalid` outcome carrying
   the per-field map; the card renders VALIDATION BLOCKED with one row per
   field. Validation rejections count as blocked requests — never errors —
   and submitted values never appear in logs or metrics.

## Extension plan for Part 6+

1. Add protection middlewares under `backend/src/middleware/` following the
   `createRateLimiter` pattern: a factory returning `{ handler, reset }`,
   options injected from `config/env.ts`.
2. Mount them per-route inside route factories
   (`createRateLimitRouter(limiter)` is the reference implementation);
   `/api/protected` stacks all of them.
3. Register new callers in `LAB_CALLERS` (`hooks/useLabRunner.ts`) and add
   each lab id to `WIRED_LAB_IDS` (`utils/constants.ts`) — the card UI,
   result rendering, burst button and telemetry refresh already generalize.
4. When persistence lands, swap `metricsService` internals without touching
   its public surface (`record`, `getSnapshot`, `getRecentLogs`,
   `recordBlocked`).

## Conventions

- Strict TypeScript on both sides; shared response contracts mirrored in
  `backend/src/types` and `frontend/src/types.ts`.
- Errors are always JSON envelopes (`{ success: false, error }`).
- No third-party UI kits; single tokenized stylesheet.
