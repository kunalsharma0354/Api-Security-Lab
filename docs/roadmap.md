# Roadmap

## Part 1 â€” Foundation & UI âœ…

- Project structure (`frontend/`, `backend/`, `docs/`, `tests/`)
- Dark developer-tool design system (CSS tokens, responsive layout)
- App shell: sticky header (brand, `LOCAL / DEMO`, API status pill, profile)
  + sidebar navigation (6 routes) + mobile drawer
- Dashboard: statistic cards, 7 API lab cards, request activity table,
  API status panel
- Placeholder pages: API Labs, Request Logs, Analytics, API Documentation,
  Settings

## Part 2 â€” Backend Foundation + First APIs âœ… (current)

- [x] Express + TypeScript server (`backend/src`), dotenv configuration
- [x] CORS locked to the local frontend origin
- [x] `GET /health` with service metadata + server timestamp
- [x] `GET /api/demo` â€” baseline unprotected endpoint (always 200)
- [x] Request logging middleware â€” method, path, status, latency; no secrets
- [x] In-memory metrics service (total / successful / error / blocked / avg)
- [x] `GET /api/metrics` returning real counters (zeros when empty)
- [x] `GET /api/logs?limit=n` recent-request feed
- [x] JSON-only error handling (404s, malformed bodies, 500s)
- [x] Frontend typed API client (`utils/apiClient.ts`) + offline error copy
- [x] Normal API card wired end-to-end: status, latency, response preview
- [x] Dashboard statistics driven by live `/api/metrics`
- [x] Request activity table fed by `/api/logs`
- [x] Header pill + status panel reflect real `/health` (20s polling)
- [x] Remaining six cards clearly marked "Coming in Part 3"
- [x] Backend test suite: 9 tests via `node --test` + tsx

## Part 3 â€” Rate Limiting âœ… (current)

- [x] Validated env config: `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_SECONDS`
- [x] Reusable fixed-window `rateLimiter` middleware (per-IP, in-memory,
      tracks count/window-start/reset; factory + `reset()` for test isolation)
- [x] `GET /api/rate-limit` â€” the only protected endpoint
      (10 requests / 60 s by default)
- [x] Standard headers on responses:
      `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- [x] Limit exceeded â†’ `429` JSON `{ success, error, retryAfter }` with a
      real window-derived `Retry-After` header (no fake values)
- [x] Blocked requests increment `blockedRequests` â€” recorded as blocked,
      not as generic errors (`Errors` stays truthful)
- [x] `/api/demo` remains completely unprotected (verified by tests)
- [x] Frontend Rate Limited card: live limit/requests/remaining/reset UI,
      dedicated 429 "RATE LIMIT REACHED" state, controlled
      "Send 5 Test Requests" burst button (sequential, capped)
- [x] API Status panel shows `Rate Limiter Â· Active` only when the backend
      reports it via `/health`
- [x] API Documentation page: rate-limiting spotlight with example
      request + both example responses
- [x] Test suite expanded to 15 tests: within-limit, exceeded, headers,
      metrics deltas, logs contain 429s, demo isolation, window reset

## Part 4 â€” API Key Authentication âœ… (current)

- [x] `DEMO_API_KEY` env config; server refuses to start with a clear
      configuration error when the key is missing (auth lab is enabled)
- [x] Reusable `apiKeyAuth` middleware: checks `X-API-Key`, missing or
      invalid keys get the identical generic `401 { success:false,
      error:"Unauthorized" }`; timing-safe hash comparison
- [x] `GET /api/auth` is the ONLY protected endpoint
- [x] Valid key â†’ `200 { success:true, message:"Authenticated API request
      processed", protection:"api-key" }`
- [x] Key never exposed: not in `/health`, `/api/metrics`, `/api/logs`,
      frontend source or docs examples (`X-API-Key: YOUR_API_KEY`
      placeholder only); console/log lines show `x-api-key=[REDACTED]`
- [x] 401s count as blocked requests (total+blocked), never as errors;
      successful auth requests count normally
- [x] 401 entries appear in `/api/logs` without any key material
- [x] Frontend auth card: API-key input field, AUTHORIZED / UNAUTHORIZED
      states ("API key required" vs "Request rejected"), latency + payload
- [x] API Status shows "API Key Authentication Â· Active" only when the
      backend reports it via `/health`
- [x] Docs spotlight for the auth endpoint with safe example responses
- [x] Isolation verified by tests: `/api/demo` unprotected, `/api/rate-limit`
      still governed solely by its limiter
- [x] Test suite expanded to 26 tests (valid/missing/invalid keys, metric
      deltas, log redaction incl. console capture, isolation)

## Part 5 â€” Input Validation âœ… (current)

- [x] `POST /api/validate` accepts `application/json` with exactly
      `{ name, email, age }`
- [x] Reusable `validateRegistration` middleware: name required text of
      2â€“100 chars (trimmed), email valid address â‰¤254 chars, age integer
      13â€“120; every problem collected and reported at once
- [x] Structured rejection: `400 { success:false, error:"Validation failed",
      fields:{ field: message } }` â€” one entry per rejected field
- [x] Unknown fields rejected (`Unexpected field "admin"`) instead of being
      silently ignored; arrays/non-object bodies rejected too
- [x] Malformed JSON on the lab route â†’ the same structured validation
      error via a scoped body-parser + `malformedJsonBlocker`, ordered so
      blocked responses are still logged and counted
- [x] Accepted payloads sanitized (name trimmed) before the handler echoes
      them as `data.received`
- [x] Validation rejections count as blocked requests, never errors;
      submitted values never appear in logs or metrics
- [x] Frontend validation card: JSON editor with safe one-click presets
      (Valid Input / Invalid Email / Invalid Age / Missing Name /
      Unknown Field â€” replace contents only, never auto-send), frontend
      JSON syntax feedback before sending, VALIDATED / VALIDATION BLOCKED
      states with per-field breakdown, chip shows `400 BLOCKED`
- [x] Docs spotlight for the validation endpoint with example request,
      success and rejection bodies
- [x] Isolation verified: demo stays open, rate-limit keeps its rules,
      auth keeps its key requirement
- [x] Test suite expanded to 46 tests (valid payloads, every rule boundary,
      multi-error collection, unknown fields, malformed JSON, metric
      deltas, log leak checks, isolation)

## Part 6+ â€” Remaining Protections (next)

- [ ] `POST /api/payload` â€” request body size rejection (413)
- [ ] `GET /api/timeout` â€” slow handler terminated by timeout (504)
- [ ] `GET /api/protected` â€” layered combination of the above
- [ ] Wire remaining cards through the existing lab-runner mechanism

## Later Parts

- Persistence for logs/metrics (SQLite or similar)
- Analytics charts computed from recorded traffic
- Expanded automated tests in `tests/`
- Optional light theme
