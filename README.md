# NEXORA API Security Lab

A professional educational dashboard for learning how common API protection mechanisms behave -- rate limiting, API key authentication, input validation, request size limits, timeouts, and layered defenses.

**Status: All 7 lab modules + API key issuer live** -- rate limiting, API key authentication, input validation, request size protection, timeout protection, and the multi-layer combination are implemented and wired end-to-end.

---

## Dashboard

![Dashboard](docs/images/dashboard.png)

---

## Current State (Part 9)

| Area | Status |
| --- | --- |
| Project structure (frontend/, backend/, docs/, tests/) | Done |
| Dark developer-tool design system | Done |
| Dashboard UI (header, sidebar, cards, tables) | Done |
| Backend as Vercel serverless functions | Done |
| GET /health health check (+ real limiter & auth config) | Done |
| GET /api/demo baseline API (Normal API card wired) | Done |
| Request logging middleware (keys redacted) | Done |
| Metrics + GET /api/metrics | Done |
| Recent-request log feed + GET /api/logs | Done |
| Live dashboard statistics & API status panel | Done |
| Fixed-window rate limiting on GET /api/rate-limit | Done |
| Rate-limit headers (X-RateLimit-*, Retry-After) + 429 JSON | Done |
| Blocked-request metrics/logs classification (not errors) | Done |
| Frontend: live limit/remaining/reset UI, 429 state, burst button | Done |
| API-key auth on GET /api/auth (X-API-Key, generic 401) | Done |
| Fail-fast startup when DEMO_API_KEY is missing | Done |
| Key redaction in logs/console; timing-safe comparison | Done |
| Frontend: auth card with key input + AUTHORIZED/UNAUTHORIZED states | Done |
| Input validation on POST /api/validate (strict schema) | Done |
| Field-by-field 400 errors; unknown fields rejected | Done |
| Malformed JSON -> structured validation error on the lab route | Done |
| Sanitized echo of accepted payloads (trimmed name) | Done |
| Frontend: validation card with JSON editor + safe presets | Done |
| Request size protection on POST /api/payload (413) | Done |
| Early Content-Length refusal + scoped parser ceiling | Done |
| Timeout protection on GET /api/timeout (504) | Done |
| Deadline cut-off with structured response; blocked-not-error | Done |
| Multi-layer protection on GET /api/protected | Done |
| Dedicated strict shield + API-key stacked in DoS-first order | Done |
| Frontend: payload editor w/ oversized preset, timeout & flood UIs | Done |
| Backend tests: 65 tests incl. leak, metric & isolation checks | Done |
| Persistence / analytics charts / SQLite | Future ideas |

No third-party APIs are called, no synthetic results are displayed, and counters only reflect requests that actually happened against the backend.

---

## Tech Stack

- **Frontend:** React 18, TypeScript (strict), Vite 5, React Router 6, hand-written CSS
- **Backend:** Vercel serverless functions (Node.js), TypeScript, Vercel KV / Upstash Redis
- **Tests:** Node built-in test runner (node:test) executed through tsx

---

## Architecture

```
nexora-api-security-lab/          # Frontend (Vercel)
  frontend/
    src/
      components/     # Header, Sidebar, cards, table, toast, status panel
      pages/          # Dashboard, ApiLabs, RequestLogs, Analytics, ApiDocs, Settings
      layouts/        # MainLayout (shell)
      hooks/          # useServicesHealth (live /health polling), useLabRunner
      styles/         # global.css design system
      utils/          # constants, apiClient (typed fetch wrapper), format helpers

NEXORA/                       # Backend (Vercel)
  api/
    health.js       # GET /health
    demo.js         # GET /api/demo
    rate-limit.js   # GET /api/rate-limit
    auth.js         # GET /api/auth
    validate.js     # POST /api/validate
    payload.js      # POST /api/payload
    timeout.js      # GET /api/timeout
    protected.js    # GET /api/protected
    metrics.js      # GET /api/metrics
    logs.js         # GET /api/logs
    keys.js         # GET/POST/DELETE /api/keys
    _lib.js         # Shared utilities (rate limiting, metrics, keys, KV)
```

Frontend (nexoralab-phi.vercel.app) calls backend APIs at nexora-navy-omega.vercel.app/api/*

---

## API Endpoints (implemented)

| Method | Path | Description |
| --- | --- | --- |
| GET | /health | Service status, environment, timestamp, real limiter & auth config |
| GET | /api/demo | Baseline unprotected API, always 200 |
| GET | /api/rate-limit | Fixed-window rate-limited API (10 req / 60 s by default) |
| GET | /api/auth | API-key protected API -- requires X-API-Key header |
| POST | /api/validate | Strict input validation -- rejects bad payloads with per-field errors |
| POST | /api/payload | Request size protection -- oversized bodies get structured 413 |
| GET | /api/timeout | Timeout protection -- slow work cut off with structured 504 |
| GET | /api/protected | Multi-layer: dedicated strict rate limiter + API-key auth |
| GET | /api/metrics | Real counters (total/success/error/blocked/avg latency) |
| GET | /api/logs?limit=25 | Most recent recorded requests |
| GET | /api/keys | List issued API keys (admin) |
| POST | /api/keys | Create new API key (admin) |
| DELETE | /api/keys?id=ID | Revoke API key (admin) |

Rate limiting: fixed window per client IP. Success responses carry X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset. Exceeding the limit returns 429 with { success:false, error, retryAfter } and a matching Retry-After header. Blocked requests count toward blockedRequests -- not toward errors. /api/demo is intentionally unprotected for comparison.

API-key auth: GET /api/auth requires X-API-Key. Missing or invalid keys get the same generic 401 { success:false, error:"Unauthorized" } -- no hint about how close a key was. Rejected requests are blocked (not errors) and logged with status 401 only; the key value is never stored, returned or printed (log lines show x-api-key=[REDACTED]). Comparison uses a timing-safe hash. Only this endpoint is protected.

Input validation: POST /api/validate accepts application/json with exactly { name, email, age }. Rules: name is required text of 2-100 characters (trimmed), email a valid address of at most 254 characters, age an integer between 13 and 120. Every problem is reported at once as 400 { success:false, error:"Validation failed", fields:{ field: message } }; unknown fields are rejected (Unexpected field) instead of silently ignored, and malformed JSON gets the same structured treatment. Accepted payloads are sanitized before echoing. Rejected requests count as blocked, and submitted values never appear in logs or metrics.

Request size protection: POST /api/payload accepts application/json bodies up to PAYLOAD_MAX_KB (default 64 KB). Oversized requests are refused before the body is read when Content-Length already exceeds the limit, and by a scoped parser ceiling as defense in depth: 413 { success:false, error:"Request body too large", limitBytes }. Only byte counts are recorded -- never body contents.

Timeout protection: GET /api/timeout deliberately simulates slow upstream work; when it exceeds TIMEOUT_MS (default 2000) the server cuts it off with 504 { success:false, error:"Request timed out", timeoutMs }. The client never hangs and timeouts count as blocked, not errors.

Multi-layer protection: GET /api/protected stacks a dedicated strict rate limiter (PROTECTED_RATE_LIMIT_*, default 5 / 60 s) before API-key auth -- DoS-first ordering, so floods hit 429 even with bad keys. The shield's window is fully isolated from the rate-limit lab. Success echoes the layers passed: { layers: ["rate-limit","api-key"] }.

Errors always return JSON: { "success": false, "error": "..." }. Metrics exclude observability traffic (/health, /api/metrics, /api/logs) so counters only count lab activity. CORS allows only the configured FRONTEND_ORIGIN.

---

## Configuration

### Frontend (nexora-api-security-lab)

Environment variable in Vercel project settings:

```
VITE_API_BASE_URL=https://nexora-navy-omega.vercel.app
```

### Backend (NEXORA project)

Environment variables in Vercel project settings:

```
LAB_DEMO_API_KEY=nexora_demo_key_change_me
RATE_LIMIT_MAX=10
RATE_LIMIT_WINDOW_SECONDS=60
PROTECTED_RATE_LIMIT_MAX=5
PROTECTED_RATE_LIMIT_WINDOW_SECONDS=60
PAYLOAD_MAX_KB=64
TIMEOUT_MS=2000
KEY_ISSUE_MAX=10
KEY_ISSUE_WINDOW_SECONDS=300
```

### Vercel KV Storage

Required for rate limiting, metrics, logs, and API key management. Enable in Vercel project settings: Storage -> Create KV Database. Or configure Upstash Redis REST API credentials:

```
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

Rate-limit values are validated at startup (positive integers) and reported truthfully by /health; the frontend reads them from there. The demo API key is required: without it the server refuses to start with a clear configuration error (the auth lab cannot silently run disabled). It is a public development value -- never a real secret -- and is never exposed by any endpoint or by the frontend source.

---

## Getting Started (Local Development)

### Frontend

```bash
cd nexora-api-security-lab/frontend
npm install
npm run dev          # -> http://localhost:5173
```

Create frontend/.env for local backend:

```
VITE_API_BASE_URL=http://localhost:3001
```

### Backend (Local Express Server)

The backend is designed for Vercel serverless functions. For local development, use the original Express backend in the separate nexora-api-security-lab/backend folder, or run Vercel CLI:

```bash
cd NEXORA
npm install -g vercel
vercel dev           # -> http://localhost:3000
```

---

## Other Scripts

Frontend (cd nexora-api-security-lab/frontend): dev, build, preview, typecheck.

---

## Lab Modules Progress

| # | Module | Endpoint | Protection | State |
| --- | --- | --- | --- | --- |
| 1 | Normal API | GET /api/demo | none | Live |
| 2 | Rate Limited API | GET /api/rate-limit | RATE LIMIT | Live |
| 3 | API Key Authentication | GET /api/auth | API KEY | Live |
| 4 | Input Validation | POST /api/validate | INPUT VALIDATION | Live |
| 5 | Request Size Protection | POST /api/payload | REQUEST SIZE | Live |
| 6 | Timeout Protection | GET /api/timeout | TIMEOUT | Live |
| 7 | Multi-Layer Protected API | GET /api/protected | MULTI-LAYER | Live |

---

## Deployment

### Frontend (nexora-api-security-lab)

1. Push to GitHub (connected to Vercel project nexoralab-phi)
2. Set VITE_API_BASE_URL in Vercel project settings to NEXORA backend URL
3. Vercel auto-deploys on push

### Backend (NEXORA)

1. Push to GitHub (connected to Vercel project nexora-navy-omega)
2. Enable Vercel KV in project settings
3. Set environment variables in Vercel project settings
4. Vercel auto-deploys on push

---

## Roadmap

- Part 1 (done) -- foundation, design system, full dashboard UI.
- Part 2 (done) -- Express backend, health/demo/metrics/logs endpoints, request logging, live stats + status panel, Normal API wired end-to-end.
- Part 3 (done) -- reusable fixed-window rate-limit middleware, rate-limited endpoint with standard headers + 429 JSON, blocked-request metrics/logs classification, live limit/remaining/reset UI with a controlled "Send 5 Test Requests" burst button, docs spotlight, Rate Limiter status from real health data, expanded test suite (15).
- Part 4 (done) -- API-key authentication on /api/auth: reusable timing-safe apiKeyAuth middleware, generic 401s, fail-fast startup when DEMO_API_KEY is missing, key redaction in logs/console, blocked-not-error metrics classification, auth card with API-key input and AUTHORIZED/UNAUTHORIZED states, docs spotlight, API Status row from real health data, test suite expanded to 26 tests.
- Part 5 (done) -- strict input validation on POST /api/validate: reusable validateRegistration middleware (name/email/age rules, all errors collected at once), unknown-field rejection, structured per-field 400 responses, malformed JSON handled on the lab route with blocked-not-error classification, sanitized echo of accepted payloads, validation card with JSON editor and safe one-click presets (replace-only, never auto-sent) plus frontend JSON syntax feedback, VALIDATED/VALIDATION BLOCKED states, docs spotlight, test suite expanded to 46 tests.
- Part 6 (done) -- request size protection on POST /api/payload: early Content-Length refusal before the body is read, scoped parser ceiling as defense in depth, structured 413 with byte counts only, oversized-preset in the payload editor, payload/timeout config reported by /health.
- Part 7 (done) -- timeout protection on GET /api/timeout: deadline wrapper terminates simulated slow work with a structured 504, cut-off happens at the deadline (client never hangs), timeouts count as blocked.
- Part 8 (done) -- multi-layer protection on GET /api/protected: dedicated strict rate limiter stacked before API-key auth (DoS-first order, flood of bad keys gets 429), shield window isolated from the main lab limiter, "Send 6 Requests" flood button in the UI, layers echoed on success. Test suite expanded to 65 tests.
- Future ideas -- persistence for logs/metrics, analytics charts, SQLite storage.

See docs/roadmap.md for details.

---

## Repository

- Frontend: https://github.com/kunalsharma0354/Api-Security-Lab
- Backend: https://github.com/kunalsharma0354/NEXORA
- Live Demo: https://nexoralab-phi.vercel.app