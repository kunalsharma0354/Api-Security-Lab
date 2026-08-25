# NEXORA · API Security Lab

A professional, local-first educational dashboard for learning how common
API protection mechanisms behave — rate limiting, API key authentication,
input validation, request size limits, timeouts and layered defenses.

> **Status: Part 5 complete — input validation implemented and wired.**
> Payload protection, timeout protection and multi-layer protection arrive
> in later parts.

---

## Current State (Part 5)

| Area | Status |
| --- | --- |
| Project structure (`frontend/`, `backend/`, `docs/`, `tests/`) | Done |
| Dark developer-tool design system | Done |
| Dashboard UI (header, sidebar, cards, tables) | Done |
| Express + TypeScript backend on port **3001** | Done |
| `GET /health` health check (+ real limiter & auth config) | Done |
| `GET /api/demo` baseline API (Normal API card wired) | Done |
| Request logging middleware (keys redacted) | Done |
| In-memory metrics + `GET /api/metrics` | Done |
| Recent-request log feed + `GET /api/logs` | Done |
| Live dashboard statistics & API status panel | Done |
| Fixed-window rate limiting on `GET /api/rate-limit` | Done |
| Rate-limit headers (`X-RateLimit-*`, `Retry-After`) + 429 JSON | Done |
| Blocked-request metrics/logs classification (not errors) | Done |
| Frontend: live limit/remaining/reset UI, 429 state, burst button | Done |
| **API-key auth on `GET /api/auth` (`X-API-Key`, generic 401)** | **Done** |
| Fail-fast startup when `DEMO_API_KEY` is missing | Done |
| Key redaction in logs/console; timing-safe comparison | Done |
| Frontend: auth card with key input + AUTHORIZED/UNAUTHORIZED states | Done |
| **Input validation on `POST /api/validate` (strict schema)** | **Done** |
| Field-by-field 400 errors; unknown fields rejected | Done |
| Malformed JSON → structured validation error on the lab route | Done |
| Sanitized echo of accepted payloads (trimmed name) | Done |
| Frontend: validation card with JSON editor + safe presets | Done |
| Backend tests: 46 tests incl. validation, leak & isolation checks | Done |
| Payload / timeout / multi-layer | Later parts |

No third-party APIs are called, no synthetic results are displayed, and
counters only reflect requests that actually happened against the local
backend.

## Tech Stack

- **Frontend:** React 18, TypeScript (strict), Vite 5, React Router 6, hand-written CSS
- **Backend:** Node.js, Express 4, TypeScript, dotenv, cors (origin-locked)
- **Tests:** Node built-in test runner (`node:test`) executed through tsx

## Getting Started (two terminals)

Terminal 1 — backend:

```bash
cd nexora-api-security-lab/backend
npm install
npm run dev          # → http://localhost:3001
```

Terminal 2 — frontend:

```bash
cd nexora-api-security-lab/frontend
npm install
npm run dev          # → http://localhost:5173
```

The frontend talks to `http://localhost:3001` by default. Override it per
environment by setting `VITE_API_BASE_URL` in `frontend/.env`.

### Other scripts

Backend (`cd backend`):

```bash
npm run dev        # tsx watch mode
npm run build      # compile TypeScript → dist/
npm run start      # run compiled dist/server.js
npm run typecheck  # strict TS check incl. tests
npm test           # node --test suite (9 tests)
```

Frontend (`cd frontend`): `dev`, `build`, `preview`, `typecheck`.

## API Endpoints (implemented)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Service status, environment, timestamp, real limiter & auth config |
| GET | `/api/demo` | Baseline unprotected API, always `200` |
| GET | `/api/rate-limit` | Fixed-window rate-limited API (10 req / 60 s by default) |
| GET | `/api/auth` | API-key protected API — requires `X-API-Key` header |
| POST | `/api/validate` | Strict input validation — rejects bad payloads with per-field errors |
| GET | `/api/metrics` | Real in-memory counters (total/success/error/blocked/avg latency) |
| GET | `/api/logs?limit=25` | Most recent recorded requests |

Rate limiting: fixed window per client IP. Success responses carry
`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
Exceeding the limit returns `429` with `{ success:false, error,
retryAfter }` and a matching `Retry-After` header. Blocked requests count
toward `blockedRequests` — not toward errors. `/api/demo` is intentionally
unprotected for comparison.

API-key auth: `GET /api/auth` requires `X-API-Key`. Missing or invalid keys
get the same generic `401 { success:false, error:"Unauthorized" }` — no hint
about how close a key was. Rejected requests are blocked (not errors) and
logged with status 401 only; the key value is never stored, returned or
printed (log lines show `x-api-key=[REDACTED]`). Comparison uses a
timing-safe hash. Only this endpoint is protected.

Input validation: `POST /api/validate` accepts `application/json` with
exactly `{ name, email, age }`. Rules: name is required text of 2–100
characters (trimmed), email a valid address of at most 254 characters, age
an integer between 13 and 120. Every problem is reported at once as
`400 { success:false, error:"Validation failed", fields:{ field: message } }`;
unknown fields are rejected (`Unexpected field`) instead of silently
ignored, and malformed JSON gets the same structured treatment. Accepted
payloads are sanitized before echoing. Rejected requests count as blocked,
and submitted values never appear in logs or metrics.

Errors always return JSON: `{ "success": false, "error": "…" }`.
Metrics exclude observability traffic (`/health`, `/api/metrics`,
`/api/logs`) so counters only count lab activity.
CORS allows only the configured `FRONTEND_ORIGIN`
(`http://localhost:5173`).

## Configuration

Copy `backend/.env.example` → `backend/.env` and adjust:

```text
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173
NODE_ENV=development
RATE_LIMIT_MAX=10
RATE_LIMIT_WINDOW_SECONDS=60
DEMO_API_KEY=nexora_demo_key_change_me
```

Rate-limit values are validated at startup (positive integers) and reported
truthfully by `/health`; the frontend reads them from there. The demo API
key is required: without it the server refuses to start with a clear
configuration error (the auth lab cannot silently run disabled). It is a
public development value from `.env.example` — never a real secret — and is
never exposed by any endpoint or by the frontend source.

## Project Structure

```text
nexora-api-security-lab/
├── frontend/
│   ├── components/     # Header, Sidebar, cards, table, toast, status panel…
│   ├── pages/          # Dashboard, ApiLabs, RequestLogs, Analytics, ApiDocs, Settings
│   ├── layouts/        # MainLayout (shell)
│   ├── hooks/          # useServicesHealth (live /health polling), useLabRunner
│   ├── styles/         # global.css design system
│   └── utils/          # constants, apiClient (typed fetch wrapper), format helpers
├── backend/
│   ├── src/
│   │   ├── server.ts   # bootstrap (+ fail-fast DEMO_API_KEY check), shutdown
│   │   ├── app.ts      # express app factory (cors, logging, routes, errors)
│   │   ├── config/     # env.ts (dotenv-backed)
│   │   ├── routes/     # health, demo, rate-limit, auth, metrics, logs
│   │   ├── middleware/ # requestLogger, errorHandler, rateLimiter, apiKeyAuth
│   │   ├── services/   # metricsService (in-memory records + snapshot math)
│   │   └── types/      # shared response contracts
│   ├── tests/api.test.ts
│   └── .env.example
├── docs/               # architecture notes and roadmap
├── tests/              # reserved for cross-cutting integration tests
├── .env.example
└── README.md
```

## Lab Modules Progress

| # | Module | Endpoint | Protection | State |
| --- | --- | --- | --- | --- |
| 1 | Normal API | `GET /api/demo` | none | **Live** |
| 2 | Rate Limited API | `GET /api/rate-limit` | RATE LIMIT | **Live** |
| 3 | API Key Authentication | `GET /api/auth` | API KEY | **Live** |
| 4 | Input Validation | `POST /api/validate` | INPUT VALIDATION | **Live** |
| 5 | Request Size Protection | `POST /api/payload` | REQUEST SIZE | Later part |
| 6 | Timeout Protection | `GET /api/timeout` | TIMEOUT | Later part |
| 7 | Multi-Layer Protected API | `GET /api/protected` | MULTI-LAYER | Later part |

## Roadmap

- **Part 1 (done)** — foundation, design system, full dashboard UI.
- **Part 2 (done)** — Express backend, health/demo/metrics/logs endpoints,
  request logging, live stats + status panel, Normal API wired end-to-end.
- **Part 3 (done)** — reusable fixed-window rate-limit middleware,
  rate-limited endpoint with standard headers + 429 JSON, blocked-request
  metrics/logs classification, live limit/remaining/reset UI with a
  controlled "Send 5 Test Requests" burst button, docs spotlight,
  Rate Limiter status from real health data, expanded test suite (15).
- **Part 4 (done)** — API-key authentication on `/api/auth`: reusable
  timing-safe `apiKeyAuth` middleware, generic 401s, fail-fast startup when
  `DEMO_API_KEY` is missing, key redaction in logs/console, blocked-not-error
  metrics classification, auth card with API-key input and
  AUTHORIZED/UNAUTHORIZED states, docs spotlight, API Status row from real
  health data, test suite expanded to 26 tests.
- **Part 5 (done)** — strict input validation on `POST /api/validate`:
  reusable `validateRegistration` middleware (name/email/age rules,
  all errors collected at once), unknown-field rejection, structured
  per-field `400` responses, malformed JSON handled on the lab route with
  blocked-not-error classification, sanitized echo of accepted payloads,
  validation card with JSON editor and safe one-click presets
  (replace-only, never auto-sent) plus frontend JSON syntax feedback,
  VALIDATED/VALIDATION BLOCKED states, docs spotlight, test suite
  expanded to 46 tests.
- **Later parts** — payload size, timeout protection, multi-layer
  combination, persistence, analytics.

See [`docs/roadmap.md`](docs/roadmap.md) for details.
