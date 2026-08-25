# Tests (reserved)

Part 1 ships UI only, so no automated tests run yet. Starting in Part 2 this
directory will hold:

- **API integration tests** against the local backend endpoints
  (rate limiting behavior, auth failures, validation rejects, size limits,
  timeout behavior).
- Optional frontend smoke tests once a test runner (e.g. Vitest) is added.

Nothing here performs attacks against third-party services — all testing
targets the local lab server on `localhost` only.
