import { API_LABS, WIRED_LAB_IDS } from "../utils/constants";
import { Badge } from "../components/Badge";
import { useServicesHealth } from "../hooks/useServicesHealth";

export function ApiDocsPage() {
  const { state: health } = useServicesHealth();
  const limiter = health.online ? (health.info?.rateLimiter ?? null) : null;
  const limitMax = limiter?.max ?? 10;
  const limitWindow = limiter?.windowSeconds ?? 60;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-kicker">Resources</div>
          <h1 className="page-title">API Documentation</h1>
          <p className="page-desc">
            Reference for the lab endpoints this dashboard targets. All routes
            are served by the local backend — nothing here calls third-party
            services.
          </p>
        </div>
      </div>

      <section className="card" aria-label="Rate limiting reference">
        <div className="panel-head">
          <h3 className="panel-title">Spotlight · Rate Limiting</h3>
          <span className="section-note">GET /api/rate-limit</span>
        </div>
        <div className="docs-body">
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Protection</span>
            <Badge label="RATE LIMITING" tone="protection" dot={false} />
          </div>
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Limit</span>
            <code className="endpoint-code">
              {limitMax} requests / {limitWindow} seconds
            </code>
          </div>
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Success</span>
            <Badge label="200 OK" tone="ready" dot={false} />
          </div>
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Exceeded</span>
            <Badge label="429 Too Many Requests" tone="warning" dot={false} />
          </div>

          <h4 className="docs-subtitle">Example request</h4>
          <pre className="code-block">{`curl -i http://localhost:3001/api/rate-limit`}</pre>

          <h4 className="docs-subtitle">Success response · 200</h4>
          <pre className="code-block">{`HTTP/1.1 200 OK
X-RateLimit-Limit: ${limitMax}
X-RateLimit-Remaining: ${Math.max(0, limitMax - 1)}
X-RateLimit-Reset: 1770000000

{
  "success": true,
  "message": "Rate-limited API request processed",
  "protection": "rate-limit"
}`}</pre>

          <h4 className="docs-subtitle">Limit exceeded · 429</h4>
          <pre className="code-block">{`HTTP/1.1 429 Too Many Requests
Retry-After: 42
X-RateLimit-Limit: ${limitMax}
X-RateLimit-Remaining: 0

{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 42
}`}</pre>

          <p className="docs-note">
            The limiter is a fixed window keyed by client IP. Blocked requests
            are recorded in metrics and logs as blocked, not as errors. The
            baseline <code>/api/demo</code> endpoint is intentionally left
            unprotected for comparison.
          </p>
        </div>
      </section>

      <section className="card" aria-label="API key authentication reference">
        <div className="panel-head">
          <h3 className="panel-title">Spotlight · API Key Authentication</h3>
          <span className="section-note">GET /api/auth</span>
        </div>
        <div className="docs-body">
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Protection</span>
            <Badge label="API KEY AUTHENTICATION" tone="protection" dot={false} />
          </div>
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Header</span>
            <code className="endpoint-code">X-API-Key: YOUR_API_KEY</code>
          </div>
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Success</span>
            <Badge label="200 OK" tone="ready" dot={false} />
          </div>
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Unauthorized</span>
            <Badge label="401 Unauthorized" tone="warning" dot={false} />
          </div>

          <h4 className="docs-subtitle">Example request</h4>
          <pre className="code-block">{`curl -i http://localhost:3001/api/auth \\
  -H "X-API-Key: YOUR_API_KEY"`}</pre>

          <h4 className="docs-subtitle">Success response · 200</h4>
          <pre className="code-block">{`HTTP/1.1 200 OK

{
  "success": true,
  "message": "Authenticated API request processed",
  "protection": "api-key"
}`}</pre>

          <h4 className="docs-subtitle">Missing or invalid key · 401</h4>
          <pre className="code-block">{`HTTP/1.1 401 Unauthorized

{
  "success": false,
  "error": "Unauthorized"
}`}</pre>

          <p className="docs-note">
            The same generic <code>401</code> body is returned for a missing
            and for an invalid key — responses never hint at how close a
            supplied key was. Rejected requests are recorded as blocked in
            metrics and logs, and the key value itself is never stored or
            printed (log lines show <code>x-api-key=[REDACTED]</code>). Only{" "}
            <code>/api/auth</code> is protected; every other lab endpoint
            keeps its own isolation.
          </p>
        </div>
      </section>

      <section className="card" aria-label="Input validation reference">
        <div className="panel-head">
          <h3 className="panel-title">Spotlight · Input Validation</h3>
          <span className="section-note">POST /api/validate</span>
        </div>
        <div className="docs-body">
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Protection</span>
            <Badge label="INPUT VALIDATION" tone="protection" dot={false} />
          </div>
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Content Type</span>
            <code className="endpoint-code">application/json</code>
          </div>
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Success</span>
            <Badge label="200 OK" tone="ready" dot={false} />
          </div>
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Rejected</span>
            <Badge label="400 Bad Request" tone="warning" dot={false} />
          </div>

          <h4 className="docs-subtitle">Example request</h4>
          <pre className="code-block">{`curl -i -X POST http://localhost:3001/api/validate \\
  -H "Content-Type: application/json" \\
  -d "{\\"name\\":\\"Kunal Sharma\\",\\"email\\":\\"user@example.com\\",\\"age\\":18}"`}</pre>

          <h4 className="docs-subtitle">Valid payload · 200</h4>
          <pre className="code-block">{`HTTP/1.1 200 OK

{
  "success": true,
  "message": "Input validation passed",
  "protection": "input-validation",
  "data": {
    "received": { "name": "Kunal Sharma", "email": "user@example.com", "age": 18 }
  }
}`}</pre>

          <h4 className="docs-subtitle">Invalid payload · 400</h4>
          <pre className="code-block">{`HTTP/1.1 400 Bad Request

{
  "success": false,
  "error": "Validation failed",
  "fields": {
    "email": "Invalid email format",
    "age": "Age must be at least 13"
  }
}`}</pre>

          <p className="docs-note">
            The backend validates every field and reports all problems at once
            — name must be a trimmed string of 2–100 characters, email a valid
            address of at most 254 characters, age an integer between 13 and
            120. Unknown fields are rejected instead of silently ignored, and
            malformed JSON gets the same structured treatment. Accepted
            payloads are sanitized (trimmed) before echoing, rejected requests
            are recorded as blocked in metrics, and submitted values are never
            written to logs.
          </p>
        </div>
      </section>

      <section className="card" aria-label="Request size protection reference">
        <div className="panel-head">
          <h3 className="panel-title">Spotlight · Request Size Protection</h3>
          <span className="section-note">POST /api/payload</span>
        </div>
        <div className="docs-body">
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Protection</span>
            <Badge label="REQUEST SIZE" tone="protection" dot={false} />
          </div>
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Limit</span>
            <code className="endpoint-code">64 KB per request body</code>
          </div>
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Success</span>
            <Badge label="200 OK" tone="ready" dot={false} />
          </div>
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Too Large</span>
            <Badge label="413 Payload Too Large" tone="warning" dot={false} />
          </div>

          <h4 className="docs-subtitle">Rejected body · 413</h4>
          <pre className="code-block">{`HTTP/1.1 413 Payload Too Large

{
  "success": false,
  "error": "Request body too large",
  "limitBytes": 65536
}`}</pre>

          <p className="docs-note">
            Oversized requests are refused before the body is read when the{" "}
            <code>Content-Length</code> header already exceeds the limit, and
            by a scoped parser ceiling as defense in depth. Rejections count as
            blocked, byte counts are logged instead of contents, and malformed
            JSON gets the same structured treatment.
          </p>
        </div>
      </section>

      <section className="card" aria-label="Timeout protection reference">
        <div className="panel-head">
          <h3 className="panel-title">Spotlight · Timeout Protection</h3>
          <span className="section-note">GET /api/timeout</span>
        </div>
        <div className="docs-body">
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Protection</span>
            <Badge label="TIMEOUT" tone="protection" dot={false} />
          </div>
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Deadline</span>
            <code className="endpoint-code">2000 ms (env-configurable)</code>
          </div>
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Terminated</span>
            <Badge label="504 Gateway Timeout" tone="warning" dot={false} />
          </div>

          <h4 className="docs-subtitle">Cut-off response · 504</h4>
          <pre className="code-block">{`HTTP/1.1 504 Gateway Timeout

{
  "success": false,
  "error": "Request timed out",
  "timeoutMs": 2000
}`}</pre>

          <p className="docs-note">
            The endpoint deliberately simulates slow upstream work; when it
            exceeds the deadline the server terminates it with a structured{" "}
            <code>504</code>. Timeouts count as blocked, appear in logs with
            their real latency, and never hang the client.
          </p>
        </div>
      </section>

      <section className="card" aria-label="Multi-layer protection reference">
        <div className="panel-head">
          <h3 className="panel-title">Spotlight · Multi-Layer Protection</h3>
          <span className="section-note">GET /api/protected</span>
        </div>
        <div className="docs-body">
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Layers</span>
            <Badge label="RATE LIMIT + API KEY" tone="protection" dot={false} />
          </div>
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Shield</span>
            <code className="endpoint-code">5 requests / 60 s (dedicated)</code>
          </div>
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Pass</span>
            <Badge label="200 OK" tone="ready" dot={false} />
          </div>
          <div className="meta-row docs-meta-row">
            <span className="meta-label">Blocked</span>
            <Badge label="401 / 429" tone="warning" dot={false} />
          </div>

          <h4 className="docs-subtitle">Layered success · 200</h4>
          <pre className="code-block">{`HTTP/1.1 200 OK

{
  "success": true,
  "message": "Multi-layer protected request processed",
  "protection": "multi-layer",
  "layers": ["rate-limit", "api-key"]
}`}</pre>

          <p className="docs-note">
            Layers stack in DoS-first order: the dedicated strict rate limiter
            runs before key checks, so floods hit <code>429</code> even with
            bad keys — exactly how a real edge shield behaves. The shield has
            its own window, fully isolated from the rate-limit lab.
          </p>
        </div>
      </section>

      <div className="section-head">
        <h2 className="section-title">All Lab Endpoints</h2>
        <span className="section-note">Base URL · http://localhost:3001</span>
      </div>

      <section className="card" aria-label="Planned endpoints">
        <div className="panel-head">
          <h3 className="panel-title">Lab Endpoints</h3>
          <span className="section-note">
            {WIRED_LAB_IDS.length} of 7 live
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Protection</th>
                <th>Module</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {API_LABS.map((lab) => {
                const wired = (WIRED_LAB_IDS as readonly string[]).includes(
                  lab.id,
                );
                return (
                  <tr key={lab.id}>
                    <td>
                      <span className="method-chip">{lab.method}</span>
                    </td>
                    <td className="cell-endpoint">{lab.endpoint}</td>
                    <td>{lab.protection ?? "None (baseline)"}</td>
                    <td>{lab.name}</td>
                    <td>
                      {wired ? (
                        <Badge label="Live" tone="ready" />
                      ) : (
                        <Badge label="Later part" tone="warning" dot={false} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card placeholder-card" aria-label="Docs note">
        <span className="placeholder-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z" />
            <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
          </svg>
        </span>
        <h2 className="placeholder-title">Full reference grows each part</h2>
        <p className="placeholder-text">
          Request/response examples, header formats and error codes are added
          alongside every protection implementation. Rate limiting and API-key
          authentication are documented above; the remaining protections
          follow in later parts.
        </p>
      </section>
    </>
  );
}
