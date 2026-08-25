import assert from "node:assert/strict";
import { createServer, request as httpRequest, type Server } from "node:http";
import test, { after, before, beforeEach, describe } from "node:test";
import { createApp } from "../src/app";
import {
  createRateLimiter,
  type RateLimiterInstance,
} from "../src/middleware/rateLimiter";
import type {
  AuthResponse,
  DemoResponse,
  ErrorResponse,
  HealthResponse,
  LogsResponse,
  MetricsSnapshot,
  RateLimitExceededResponse,
  RateLimitResponse,
  UnauthorizedResponse,
} from "../src/types";

interface TestServer {
  baseUrl: string;
  close(): Promise<void>;
}

async function startServer(app: ReturnType<typeof createApp>): Promise<TestServer> {
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Failed to acquire test server port");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

async function getJson<T>(
  baseUrl: string,
  path: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; headers: Headers; body: T }> {
  const res = await fetch(`${baseUrl}${path}`, { headers });
  const body = (await res.json()) as T;
  return { status: res.status, headers: res.headers, body };
}

/* ------------------------------------------------------------------ */
/* Default application                                                 */
/* ------------------------------------------------------------------ */

let server: TestServer;

before(async () => {
  server = await startServer(createApp());
});

after(async () => {
  await server.close();
});

describe("GET /health", () => {
  test("returns 200 with service metadata and timestamp", async () => {
    const { status, body } = await getJson<HealthResponse>(server.baseUrl, "/health");

    assert.equal(status, 200);
    assert.equal(body.status, "ok");
    assert.equal(body.service, "NEXORA API Security Lab");
    assert.ok(body.environment.length > 0);
    assert.ok(!Number.isNaN(Date.parse(body.timestamp)));
  });

  test("reports the real rate-limiter configuration", async () => {
    const { body } = await getJson<HealthResponse>(server.baseUrl, "/health");
    assert.equal(body.rateLimiter.active, true);
    assert.ok(Number.isInteger(body.rateLimiter.max));
    assert.ok(body.rateLimiter.max > 0);
    assert.ok(body.rateLimiter.windowSeconds > 0);
  });

  test("reports auth as inactive when no demo key is configured", async () => {
    // Explicitly unconfigured app — independent of any local .env file.
    const bare = await startServer(createApp({ demoApiKey: undefined }));
    try {
      const { body } = await getJson<HealthResponse>(bare.baseUrl, "/health");
      assert.equal(body.auth.active, false);
      // The health payload must never contain key material.
      assert.equal("apiKey" in body, false);
      assert.equal("demoApiKey" in body, false);
    } finally {
      await bare.close();
    }
  });

  test("unconfigured auth lab answers with a clear configuration error", async () => {
    const bare = await startServer(createApp({ demoApiKey: undefined }));
    try {
      const { status, body } = await getJson<ErrorResponse>(bare.baseUrl, "/api/auth");
      assert.equal(status, 503);
      assert.equal(body.success, false);
      assert.ok(body.error.toLowerCase().includes("not configured"));
    } finally {
      await bare.close();
    }
  });
});

describe("GET /api/demo", () => {
  test("returns 200 with a successful baseline payload", async () => {
    const { status, body } = await getJson<DemoResponse>(server.baseUrl, "/api/demo");

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.message, "Demo API request processed");
    assert.equal(body.protection, "none");
    assert.ok(!Number.isNaN(Date.parse(body.data.processedAt)));
    assert.ok(body.data.requestId.length > 0);
  });
});

describe("GET /api/metrics", () => {
  test("returns 200 with numeric metric fields", async () => {
    const { status, body } = await getJson<MetricsSnapshot>(server.baseUrl, "/api/metrics");

    assert.equal(status, 200);
    for (const key of [
      "totalRequests",
      "successfulRequests",
      "errorRequests",
      "blockedRequests",
      "averageLatency",
    ] as const) {
      assert.equal(typeof body[key], "number", `${key} should be a number`);
    }
    assert.ok(body.blockedRequests >= 0);
  });
});

describe("metrics behavior", () => {
  test("demo request increments total and successful counters by exactly one", async () => {
    const before = (await getJson<MetricsSnapshot>(server.baseUrl, "/api/metrics")).body;
    const demo = await getJson<DemoResponse>(server.baseUrl, "/api/demo");
    assert.equal(demo.status, 200);

    const after = (await getJson<MetricsSnapshot>(server.baseUrl, "/api/metrics")).body;

    assert.equal(after.totalRequests - before.totalRequests, 1);
    assert.equal(after.successfulRequests - before.successfulRequests, 1);
    assert.equal(after.errorRequests - before.errorRequests, 0);
    assert.ok(Number.isFinite(after.averageLatency));
    assert.ok(after.averageLatency >= 0);
  });

  test("average latency reflects real measured requests", async () => {
    const runs = 3;
    const before = (await getJson<MetricsSnapshot>(server.baseUrl, "/api/metrics")).body;
    for (let i = 0; i < runs; i += 1) {
      const res = await fetch(`${server.baseUrl}/api/demo`);
      assert.equal(res.status, 200);
    }
    const after = (await getJson<MetricsSnapshot>(server.baseUrl, "/api/metrics")).body;

    assert.equal(after.totalRequests - before.totalRequests, runs);
    assert.equal(after.successfulRequests - before.successfulRequests, runs);
    assert.ok(Number.isFinite(after.averageLatency));
    assert.ok(after.averageLatency >= 0);
  });

  test("logs endpoint records recent request entries", async () => {
    await getJson<DemoResponse>(server.baseUrl, "/api/demo");
    const { status, body } = await getJson<LogsResponse>(server.baseUrl, "/api/logs?limit=10");

    assert.equal(status, 200);
    assert.ok(body.logs.length >= 1);
    const latest = body.logs[0];
    assert.ok(!Number.isNaN(Date.parse(latest.timestamp)));
    assert.equal(typeof latest.latencyMs, "number");
  });
});

describe("error handling", () => {
  test("unknown routes return JSON 404 responses", async () => {
    const { status, body } = await getJson<ErrorResponse>(
      server.baseUrl,
      "/api/does-not-exist",
    );

    assert.equal(status, 404);
    assert.equal(body.success, false);
    assert.ok(body.error.includes("/api/does-not-exist"));
  });

  test("malformed JSON bodies return structured JSON errors", async () => {
    const res = await fetch(`${server.baseUrl}/api/demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-valid-json",
    });
    const body = (await res.json()) as ErrorResponse;

    assert.equal(res.status, 400);
    assert.equal(body.success, false);
  });
});

/* ------------------------------------------------------------------ */
/* Rate limiting                                                       */
/* ------------------------------------------------------------------ */

const RL_MAX = 3;
const RL_WINDOW_MS = 60_000;

describe("GET /api/rate-limit", () => {
  let rl: TestServer;
  let limiter: RateLimiterInstance;

  before(async () => {
    limiter = createRateLimiter({ max: RL_MAX, windowMs: RL_WINDOW_MS });
    rl = await startServer(createApp({ rateLimiter: limiter }));
  });

  beforeEach(() => {
    limiter.reset();
  });

  after(async () => {
    await rl.close();
  });

  test("requests within the configured limit succeed with 200", async () => {
    for (let expectedRemaining = RL_MAX - 1; expectedRemaining >= 0; expectedRemaining--) {
      const res = await fetch(`${rl.baseUrl}/api/rate-limit`);
      const body = (await res.json()) as RateLimitResponse;

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.protection, "rate-limit");
      assert.equal(res.headers.get("x-ratelimit-limit"), String(RL_MAX));
      assert.equal(
        res.headers.get("x-ratelimit-remaining"),
        String(expectedRemaining),
      );
      const resetHeader = Number(res.headers.get("x-ratelimit-reset"));
      assert.ok(Number.isInteger(resetHeader));
      assert.ok(resetHeader * 1000 > Date.now() - 1000);
    }
  });

  test("requests beyond the limit are rejected with 429 and real retryAfter", async () => {
    for (let i = 0; i < RL_MAX; i += 1) {
      const res = await fetch(`${rl.baseUrl}/api/rate-limit`);
      assert.equal(res.status, 200);
    }

    const res = await fetch(`${rl.baseUrl}/api/rate-limit`);
    const body = (await res.json()) as RateLimitExceededResponse;

    assert.equal(res.status, 429);
    assert.equal(body.success, false);
    assert.equal(body.error, "Rate limit exceeded");
    assert.ok(Number.isInteger(body.retryAfter));
    assert.ok(body.retryAfter >= 1 && body.retryAfter <= Math.ceil(RL_WINDOW_MS / 1000));
    assert.equal(res.headers.get("retry-after"), String(body.retryAfter));
    assert.equal(res.headers.get("x-ratelimit-remaining"), "0");

    const resetAtSec = Number(res.headers.get("x-ratelimit-reset"));
    assert.ok(Number.isInteger(resetAtSec));
    assert.ok(Math.abs(resetAtSec * 1000 - (Date.now() + body.retryAfter * 1000)) < 1500);
  });

  test("blocked requests increment blockedRequests but not errorRequests", async () => {
    const beforeSnap = (await getJson<MetricsSnapshot>(rl.baseUrl, "/api/metrics")).body;

    const statuses: number[] = [];
    for (let i = 0; i < RL_MAX + 2; i += 1) {
      const res = await fetch(`${rl.baseUrl}/api/rate-limit`);
      statuses.push(res.status);
    }

    const afterSnap = (await getJson<MetricsSnapshot>(rl.baseUrl, "/api/metrics")).body;

    assert.deepEqual(
      statuses.filter((s) => s === 200).length,
      RL_MAX,
    );
    assert.equal(statuses.filter((s) => s === 429).length, 2);

    assert.equal(afterSnap.totalRequests - beforeSnap.totalRequests, RL_MAX + 2);
    assert.equal(afterSnap.successfulRequests - beforeSnap.successfulRequests, RL_MAX);
    assert.equal(afterSnap.blockedRequests - beforeSnap.blockedRequests, 2);
    assert.equal(
      afterSnap.errorRequests - beforeSnap.errorRequests,
      0,
      "429 responses are blocked, not generic errors",
    );
  });

  test("blocked requests appear in /api/logs with status 429", async () => {
    for (let i = 0; i <= RL_MAX; i += 1) {
      await fetch(`${rl.baseUrl}/api/rate-limit`);
    }

    const { body } = await getJson<LogsResponse>(rl.baseUrl, "/api/logs?limit=20");
    const blockedEntries = body.logs.filter(
      (log) => log.endpoint === "/api/rate-limit" && log.statusCode === 429,
    );

    assert.ok(blockedEntries.length >= 1);
  });

  test("the normal API is completely unaffected by the rate limiter", async () => {
    for (let i = 0; i <= RL_MAX + 1; i += 1) {
      await fetch(`${rl.baseUrl}/api/rate-limit`);
    }

    const res = await fetch(`${rl.baseUrl}/api/demo`);
    const body = (await res.json()) as DemoResponse;

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(res.headers.get("x-ratelimit-limit"), null);
    assert.equal(res.headers.get("x-ratelimit-remaining"), null);
    assert.equal(res.headers.get("retry-after"), null);
  });
});

describe("rate limit window reset", () => {
  let rl: TestServer;
  let limiter: RateLimiterInstance;

  before(async () => {
    limiter = createRateLimiter({ max: 1, windowMs: 400 });
    rl = await startServer(createApp({ rateLimiter: limiter }));
  });

  after(async () => {
    await rl.close();
  });

  test("a fresh fixed window allows requests again without restart", async () => {
    const first = await fetch(`${rl.baseUrl}/api/rate-limit`);
    assert.equal(first.status, 200);

    const blocked = await fetch(`${rl.baseUrl}/api/rate-limit`);
    assert.equal(blocked.status, 429);

    await new Promise((resolve) => setTimeout(resolve, 450));

    const afterReset = await fetch(`${rl.baseUrl}/api/rate-limit`);
    assert.equal(afterReset.status, 200);
    assert.equal(afterReset.headers.get("x-ratelimit-remaining"), "0");
  });
});

/* ------------------------------------------------------------------ */
/* API key authentication (Part 4)                                     */
/* ------------------------------------------------------------------ */

const TEST_KEY = "test_demo_key_12345";

describe("GET /api/auth (API key authentication)", () => {
  let auth: TestServer;
  let limiter: RateLimiterInstance;

  before(async () => {
    // Generous limiter so rate limiting never interferes with auth tests.
    limiter = createRateLimiter({ max: 1000, windowMs: 60_000 });
    auth = await startServer(createApp({ demoApiKey: TEST_KEY, rateLimiter: limiter }));
  });

  after(async () => {
    await auth.close();
  });

  test("health reports the authentication lab as active", async () => {
    const { body } = await getJson<HealthResponse>(auth.baseUrl, "/health");
    assert.equal(body.auth.active, true);
    const raw = JSON.stringify(body);
    assert.ok(!raw.includes(TEST_KEY), "health must never contain the demo key");
  });

  test("a valid API key returns 200 with the authenticated payload", async () => {
    const { status, body } = await getJson<AuthResponse>(
      auth.baseUrl,
      "/api/auth",
      { "X-API-Key": TEST_KEY },
    );

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.message, "Authenticated API request processed");
    assert.equal(body.protection, "api-key");
    assert.ok(!Number.isNaN(Date.parse(body.data.processedAt)));
    assert.ok(body.data.requestId.length > 0);
  });

  test("a missing API key returns a generic 401", async () => {
    const { status, body } = await getJson<UnauthorizedResponse>(auth.baseUrl, "/api/auth");

    assert.equal(status, 401);
    assert.equal(body.success, false);
    assert.equal(body.error, "Unauthorized");
  });

  test("an invalid API key returns the exact same generic 401 body shape", async () => {
    const missing = await getJson<UnauthorizedResponse>(auth.baseUrl, "/api/auth");
    const invalid = await getJson<UnauthorizedResponse>(
      auth.baseUrl,
      "/api/auth",
      { "X-API-Key": "wrong-key" },
    );
    const nearMiss = await getJson<UnauthorizedResponse>(
      auth.baseUrl,
      "/api/auth",
      { "X-API-Key": `${TEST_KEY}-x` },
    );

    for (const res of [invalid, nearMiss]) {
      assert.equal(res.status, 401);
      assert.deepEqual(res.body, missing.body);
      assert.ok(!JSON.stringify(res.body).includes(TEST_KEY));
    }
  });

  test("401s count as blocked requests, not errors; valid keys as successful", async () => {
    const beforeSnap = (await getJson<MetricsSnapshot>(auth.baseUrl, "/api/metrics")).body;

    await getJson<UnauthorizedResponse>(auth.baseUrl, "/api/auth");
    await getJson<UnauthorizedResponse>(auth.baseUrl, "/api/auth", { "X-API-Key": "wrong" });

    const midSnap = (await getJson<MetricsSnapshot>(auth.baseUrl, "/api/metrics")).body;
    assert.equal(midSnap.totalRequests - beforeSnap.totalRequests, 2);
    assert.equal(midSnap.blockedRequests - beforeSnap.blockedRequests, 2);
    assert.equal(midSnap.successfulRequests - beforeSnap.successfulRequests, 0);
    assert.equal(
      midSnap.errorRequests - beforeSnap.errorRequests,
      0,
      "rejected authentication is blocked, not an error",
    );

    const ok = await getJson<AuthResponse>(auth.baseUrl, "/api/auth", { "X-API-Key": TEST_KEY });
    assert.equal(ok.status, 200);

    const afterSnap = (await getJson<MetricsSnapshot>(auth.baseUrl, "/api/metrics")).body;
    assert.equal(afterSnap.totalRequests - beforeSnap.totalRequests, 3);
    assert.equal(afterSnap.successfulRequests - beforeSnap.successfulRequests, 1);
    assert.equal(afterSnap.blockedRequests - beforeSnap.blockedRequests, 2);
    assert.equal(afterSnap.errorRequests - beforeSnap.errorRequests, 0);
  });

  test("401 entries appear in /api/logs and never include the actual key", async () => {
    await getJson<UnauthorizedResponse>(auth.baseUrl, "/api/auth", { "X-API-Key": "wrong-key" });
    await getJson<AuthResponse>(auth.baseUrl, "/api/auth", { "X-API-Key": TEST_KEY });

    const logsRes = await fetch(`${auth.baseUrl}/api/logs?limit=50`);
    const rawText = await logsRes.text();
    const parsed = JSON.parse(rawText) as LogsResponse;

    const rejected = parsed.logs.filter(
      (log) => log.endpoint === "/api/auth" && log.statusCode === 401,
    );
    const accepted = parsed.logs.filter(
      (log) => log.endpoint === "/api/auth" && log.statusCode === 200,
    );
    assert.ok(rejected.length >= 1, "401 requests must appear in the logs");
    assert.ok(accepted.length >= 1);

    assert.ok(
      !rawText.includes(TEST_KEY),
      "the API key value itself must never be stored or returned by /api/logs",
    );
  });

  test("console output redacts the API key behind [REDACTED]", async () => {
    const originalLog = console.log;
    const lines: string[] = [];
    console.log = (...args: unknown[]) => {
      lines.push(args.map((a) => String(a)).join(" "));
    };
    try {
      const res = await fetch(`${auth.baseUrl}/api/auth`, {
        headers: { "X-API-Key": TEST_KEY },
      });
      assert.equal(res.status, 200);
      await new Promise((resolve) => setTimeout(resolve, 30));
    } finally {
      console.log = originalLog;
    }

    const joined = lines.join("\n");
    assert.ok(!joined.includes(TEST_KEY), "the key must never be printed");
    assert.ok(
      lines.some((line) => line.includes("x-api-key=[REDACTED]")),
      "requests carrying the header should show the redaction marker",
    );
  });

  test("/api/demo stays completely unprotected (no key required)", async () => {
    const res = await fetch(`${auth.baseUrl}/api/demo`);
    const body = (await res.json()) as DemoResponse;

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.protection, "none");
  });

  test("/api/rate-limit still requires no API key and follows its own rules", async () => {
    limiter.reset();

    const first = await fetch(`${auth.baseUrl}/api/rate-limit`);
    const body = (await first.json()) as RateLimitResponse;

    assert.equal(first.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.protection, "rate-limit");
    assert.equal(first.headers.get("x-api-key"), null);
    assert.equal(first.headers.get("x-ratelimit-remaining"), String(limiter.options.max - 1));
  });
});

/* ------------------------------------------------------------------ */
/* Input validation (Part 5)                                           */
/* ------------------------------------------------------------------ */

const VALID_BODY = {
  name: "Kunal Sharma",
  email: "user@example.com",
  age: 18,
};

describe("POST /api/validate (input validation)", () => {
  let app5: TestServer;
  let limiter: RateLimiterInstance;

  before(async () => {
    limiter = createRateLimiter({ max: 1000, windowMs: 60_000 });
    app5 = await startServer(
      createApp({ demoApiKey: TEST_KEY, rateLimiter: limiter }),
    );
  });

  after(async () => {
    await app5.close();
  });

  async function postRaw(
    bodyText: string,
    headers: Record<string, string> = { "Content-Type": "application/json" },
  ): Promise<{ status: number; body: any; text: string }> {
    const res = await fetch(`${app5.baseUrl}/api/validate`, {
      method: "POST",
      headers,
      body: bodyText,
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    return { status: res.status, body: parsed, text };
  }

  function postJson(payload: unknown): Promise<{ status: number; body: any; text: string }> {
    return postRaw(JSON.stringify(payload));
  }

  test("a valid payload returns 200 with the validated echo", async () => {
    const { status, body } = await postJson(VALID_BODY);

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.message, "Input validation passed");
    assert.equal(body.protection, "input-validation");
    assert.equal(body.data.received.name, "Kunal Sharma");
    assert.equal(body.data.received.age, 18);
  });

  test("surrounding whitespace in name is trimmed", async () => {
    const { status, body } = await postJson({ ...VALID_BODY, name: "  Kunal Sharma  " });
    assert.equal(status, 200);
    assert.equal(body.data.received.name, "Kunal Sharma");
  });

  test("boundary values pass: shortest/longest name, min/max age", async () => {
    const ok1 = await postJson({ name: "Ab", email: "a@b.co", age: 13 });
    assert.equal(ok1.status, 200);
    const ok2 = await postJson({ name: "x".repeat(100), email: "user@example.com", age: 120 });
    assert.equal(ok2.status, 200);
  });

  test("missing name is rejected with a field error", async () => {
    const { name, ...rest } = VALID_BODY;
    const { status, body } = await postJson(rest);

    assert.equal(status, 400);
    assert.equal(body.success, false);
    assert.equal(body.error, "Validation failed");
    assert.match(String(body.fields?.name), /required/i);
  });

  test("invalid name type is rejected", async () => {
    const res = await postJson({ ...VALID_BODY, name: 42 });
    assert.equal(res.status, 400);
    assert.match(String(res.body.fields?.name), /string/i);
  });

  test("too-short name is rejected (after trimming)", async () => {
    const res = await postJson({ ...VALID_BODY, name: "   K   " });
    assert.equal(res.status, 400);
    assert.match(String(res.body.fields?.name), /at least 2/i);
  });

  test("too-long name is rejected", async () => {
    const res = await postJson({ ...VALID_BODY, name: "n".repeat(101) });
    assert.equal(res.status, 400);
    assert.match(String(res.body.fields?.name), /at most 100/i);
  });

  test("invalid email formats are rejected", async () => {
    for (const bad of ["not-an-email", "a@b", "a b@c.com", "@example.com"]) {
      const res = await postJson({ ...VALID_BODY, email: bad });
      assert.equal(res.status, 400, `expected 400 for ${bad}`);
      assert.match(String(res.body.fields?.email), /invalid email format/i);
    }
  });

  test("over-long email is rejected", async () => {
    const longEmail = `${"e".repeat(250)}@example.com`; // > 254 chars
    const res = await postJson({ ...VALID_BODY, email: longEmail });
    assert.equal(res.status, 400);
    assert.match(String(res.body.fields?.email), /at most 254/i);
  });

  test("age below minimum is rejected with the real bound", async () => {
    const res = await postJson({ ...VALID_BODY, age: 12 });
    assert.equal(res.status, 400);
    assert.match(String(res.body.fields?.age), /at least 13/i);
  });

  test("age above maximum is rejected", async () => {
    const res = await postJson({ ...VALID_BODY, age: 121 });
    assert.equal(res.status, 400);
    assert.match(String(res.body.fields?.age), /at most 120/i);
  });

  test("non-integer ages are rejected (float and string)", async () => {
    const floatRes = await postJson({ ...VALID_BODY, age: 18.5 });
    assert.equal(floatRes.status, 400);
    assert.match(String(floatRes.body.fields?.age), /integer/i);

    const strRes = await postJson({ ...VALID_BODY, age: "18" });
    assert.equal(strRes.status, 400);
    assert.match(String(strRes.body.fields?.age), /integer/i);
  });

  test("missing multiple fields reports every missing field at once", async () => {
    const res = await postJson({});
    assert.equal(res.status, 400);
    assert.ok(Object.keys(res.body.fields).includes("name"));
    assert.ok(Object.keys(res.body.fields).includes("email"));
    assert.ok(Object.keys(res.body.fields).includes("age"));
  });

  test("unknown fields are rejected, not ignored silently", async () => {
    const res = await postJson({ ...VALID_BODY, admin: true });
    assert.equal(res.status, 400);
    assert.match(String(res.body.fields?.admin), /unexpected field/i);
  });

  test("multiple problems are collected in one response", async () => {
    const res = await postJson({
      name: "K",
      email: "nope",
      age: 5,
      role: "admin",
    });
    assert.equal(res.status, 400);
    const keys = Object.keys(res.body.fields).sort();
    assert.deepEqual(keys, ["age", "email", "name", "role"]);
  });

  test("malformed JSON gets a clean structured 400 without internals", async () => {
    const res = await postRaw("{bad-json…", { "Content-Type": "application/json" });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(!res.text.includes("stack"));
    assert.ok(!res.text.includes("at "), "no stack frames leaked");
    assert.ok(
      String(res.body.fields?.body ?? res.body.error).length > 0,
    );
  });

  test("non-JSON content type with garbage body still yields structured 400", async () => {
    const res = await postRaw("hello world", { "Content-Type": "text/plain" });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  test("blocked validations count as blocked, never as errors", async () => {
    const beforeSnap = (await getJson<MetricsSnapshot>(app5.baseUrl, "/api/metrics")).body;

    await postJson({ ...VALID_BODY, email: "nope" }); // 400
    await postJson({ ...VALID_BODY, age: 121 });      // 400
    await postJson({});                                // 400

    const midSnap = (await getJson<MetricsSnapshot>(app5.baseUrl, "/api/metrics")).body;
    assert.equal(midSnap.totalRequests - beforeSnap.totalRequests, 3);
    assert.equal(midSnap.blockedRequests - beforeSnap.blockedRequests, 3);
    assert.equal(midSnap.successfulRequests - beforeSnap.successfulRequests, 0);
    assert.equal(
      midSnap.errorRequests - beforeSnap.errorRequests,
      0,
      "validation rejections are blocked, not errors",
    );

    const ok = await postJson(VALID_BODY);            // 200
    assert.equal(ok.status, 200);

    const afterSnap = (await getJson<MetricsSnapshot>(app5.baseUrl, "/api/metrics")).body;
    assert.equal(afterSnap.totalRequests - beforeSnap.totalRequests, 4);
    assert.equal(afterSnap.successfulRequests - beforeSnap.successfulRequests, 1);
    assert.equal(afterSnap.blockedRequests - beforeSnap.blockedRequests, 3);
  });

  test("validation failures appear in logs as 400s without payload contents", async () => {
    await postJson({ name: "Leaky Log", email: "not-an-email", age: 99 });

    const logsRes = await fetch(`${app5.baseUrl}/api/logs?limit=50`);
    const rawText = await logsRes.text();
    const parsed = JSON.parse(rawText) as LogsResponse;

    const rejected = parsed.logs.filter(
      (log) => log.endpoint === "/api/validate" && log.statusCode === 400,
    );
    assert.ok(rejected.length >= 1, "400 entries must appear in the logs");

    assert.ok(!rawText.includes("not-an-email"), "submitted values must never be logged");
    assert.ok(!rawText.includes("Leaky Log"), "request bodies must never be stored");
  });

  test("isolation: demo stays open, rate-limit keeps its rules, auth keeps its key", async () => {
    const demo = await fetch(`${app5.baseUrl}/api/demo`);
    assert.equal(demo.status, 200);
    assert.equal(demo.headers.get("x-ratelimit-limit"), null);

    limiter.reset();
    const rl = await fetch(`${app5.baseUrl}/api/rate-limit`);
    assert.equal(rl.status, 200);
    assert.notEqual(rl.headers.get("x-ratelimit-remaining"), null);

    const noKey = await fetch(`${app5.baseUrl}/api/auth`);
    assert.equal(noKey.status, 401);
    const withKey = await fetch(`${app5.baseUrl}/api/auth`, {
      headers: { "X-API-Key": TEST_KEY },
    });
    assert.equal(withKey.status, 200);
  });
});

/* ------------------------------------------------------------------ */
/* Request size protection (Part 6) — POST /api/payload                */
/* ------------------------------------------------------------------ */

describe("POST /api/payload (request size protection)", () => {
  let app6: TestServer;
  let limiter: RateLimiterInstance;
  const MAX_KB = 1; // 1 KB keeps oversized tests fast
  const MAX_BYTES = MAX_KB * 1024;

  before(async () => {
    limiter = createRateLimiter({ max: 1000, windowMs: 60_000 });
    app6 = await startServer(
      createApp({
        demoApiKey: TEST_KEY,
        rateLimiter: limiter,
        payloadMaxKb: MAX_KB,
        timeoutMs: 300,
        protectedRateLimit: { max: 3, windowSeconds: 1 },
      }),
    );
  });

  after(async () => {
    await app6.close();
  });

  async function postPayload(raw: string): Promise<{ status: number; body: any }> {
    const res = await fetch(`${app6.baseUrl}/api/payload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw,
    });
    return { status: res.status, body: await res.json() };
  }

  /** Raw request with a hand-set Content-Length (undici fetch refuses to lie). */
  function rawPost(
    path: string,
    headers: Record<string, string>,
    body: string,
  ): Promise<{ status: number; body: any }> {
    return new Promise((resolve, reject) => {
      const url = new URL(app6.baseUrl);
      const req = httpRequest(
        {
          host: url.hostname,
          port: url.port,
          path,
          method: "POST",
          headers,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => (data += chunk.toString()));
          res.on("end", () => {
            try {
              resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
            } catch {
              resolve({ status: res.statusCode ?? 0, body: null });
            }
          });
        },
      );
      req.on("error", reject);
      req.end(body);
    });
  }

  test("a small payload is accepted with size echo", async () => {
    const { status, body } = await postPayload('{"note":"tiny"}');

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.message, "Payload accepted");
    assert.equal(body.protection, "request-size");
    assert.ok(body.data.sizeBytes > 0);
    assert.equal(body.data.maxBytes, MAX_BYTES);
    assert.deepEqual(body.data.keys, ["note"]);
  });

  test("an oversized body is rejected with structured 413", async () => {
    const big = `{"data":"${"a".repeat(MAX_BYTES)}"}`;
    const { status, body } = await postPayload(big);

    assert.equal(status, 413);
    assert.equal(body.success, false);
    assert.equal(body.error, "Request body too large");
    assert.equal(typeof body.limitBytes, "number");
    assert.ok(!JSON.stringify(body).includes("aaaa"), "body contents must not be echoed");
  });

  test("an inflated Content-Length is refused before the body is read", async () => {
    const { status, body } = await rawPost(
      "/api/payload",
      {
        "Content-Type": "application/json",
        // Lie about the size; the guard must reject on the header alone.
        "Content-Length": String(MAX_BYTES * 10),
      },
      "{}",
    );

    assert.equal(status, 413);
    assert.equal(body.error, "Request body too large");
    assert.equal(body.limitBytes, MAX_BYTES);
    assert.equal(body.receivedBytes, MAX_BYTES * 10);
  });

  test("malformed JSON on this route gets the structured validation error", async () => {
    const { status, body } = await postPayload("{nope");

    assert.equal(status, 400);
    assert.equal(body.success, false);
    assert.equal(body.fields.body, "Request body must be valid JSON");
  });

  test("non-object JSON bodies are rejected", async () => {
    const arrRes = await postPayload("[1,2,3]");
    assert.equal(arrRes.status, 400);

    const strRes = await postPayload('"just a string"');
    assert.equal(strRes.status, 400);
  });

  test("oversized rejections count as blocked, never as errors", async () => {
    const beforeSnap = (await getJson<MetricsSnapshot>(app6.baseUrl, "/api/metrics")).body;

    await postPayload(`{"data":"${"a".repeat(MAX_BYTES)}"}`); // 413

    const afterSnap = (await getJson<MetricsSnapshot>(app6.baseUrl, "/api/metrics")).body;
    assert.equal(afterSnap.totalRequests - beforeSnap.totalRequests, 1);
    assert.equal(afterSnap.blockedRequests - beforeSnap.blockedRequests, 1);
    assert.equal(afterSnap.errorRequests - beforeSnap.errorRequests, 0);
    assert.equal(afterSnap.successfulRequests - beforeSnap.successfulRequests, 0);
  });

  test("payload rejections appear in logs without body contents", async () => {
    await postPayload(`{"data":"${"a".repeat(MAX_BYTES)}"}`); // 413
    await postPayload('{"secret_marker_xyz":true}');           // 200

    const logsText = await (
      await fetch(`${app6.baseUrl}/api/logs?limit=50`)
    ).text();
    const parsed = JSON.parse(logsText) as LogsResponse;

    const rejected = parsed.logs.filter(
      (log) => log.endpoint === "/api/payload" && log.statusCode === 413,
    );
    assert.ok(rejected.length >= 1, "413 entries must be recorded");

    assert.ok(!logsText.includes("secret_marker_xyz"), "bodies must never be logged");
    assert.ok(!logsText.includes("aaaa"));
  });

  test("health reports the real payload limit", async () => {
    const { body } = await getJson<any>(app6.baseUrl, "/health");
    assert.equal(body.payload.active, true);
    assert.equal(body.payload.maxKb, MAX_KB);
  });
});

/* ------------------------------------------------------------------ */
/* Timeout protection (Part 7) — GET /api/timeout                      */
/* ------------------------------------------------------------------ */

describe("GET /api/timeout (timeout protection)", () => {
  let app7: TestServer;
  let limiter: RateLimiterInstance;
  const TIMEOUT_MS = 300;

  before(async () => {
    limiter = createRateLimiter({ max: 1000, windowMs: 60_000 });
    app7 = await startServer(
      createApp({
        demoApiKey: TEST_KEY,
        rateLimiter: limiter,
        payloadMaxKb: 1,
        timeoutMs: TIMEOUT_MS,
        protectedRateLimit: { max: 3, windowSeconds: 1 },
      }),
    );
  });

  after(async () => {
    await app7.close();
  });

  test("a slow handler is cut off with a structured 504 near the deadline", async () => {
    const startedAt = Date.now();
    const res = await fetch(`${app7.baseUrl}/api/timeout`);
    const elapsed = Date.now() - startedAt;
    const body = (await res.json()) as any;

    assert.equal(res.status, 504);
    assert.equal(body.success, false);
    assert.equal(body.error, "Request timed out");
    assert.equal(body.timeoutMs, TIMEOUT_MS);
    // The cut-off must happen at the deadline, not after the simulated work.
    assert.ok(elapsed < 2000, `cut off quickly (took ${elapsed}ms)`);
    assert.ok(elapsed >= TIMEOUT_MS - 50, "not cut off before the deadline");
  });

  test("timeouts count as blocked, never as errors", async () => {
    const beforeSnap = (await getJson<MetricsSnapshot>(app7.baseUrl, "/api/metrics")).body;

    await fetch(`${app7.baseUrl}/api/timeout`); // 504

    const afterSnap = (await getJson<MetricsSnapshot>(app7.baseUrl, "/api/metrics")).body;
    assert.equal(afterSnap.totalRequests - beforeSnap.totalRequests, 1);
    assert.equal(afterSnap.blockedRequests - beforeSnap.blockedRequests, 1);
    assert.equal(afterSnap.errorRequests - beforeSnap.errorRequests, 0);
  });

  test("timeout entries appear in logs as 504s", async () => {
    await fetch(`${app7.baseUrl}/api/timeout`);

    const parsed = await (
      await fetch(`${app7.baseUrl}/api/logs?limit=50`)
    ).json() as LogsResponse;

    const timedOut = parsed.logs.filter(
      (log) => log.endpoint === "/api/timeout" && log.statusCode === 504,
    );
    assert.ok(timedOut.length >= 1, "504 entries must be recorded");
  });

  test("isolation: other labs are unaffected by the slow route", async () => {
    const demo = await fetch(`${app7.baseUrl}/api/demo`);
    assert.equal(demo.status, 200);
    const health = await fetch(`${app7.baseUrl}/health`);
    assert.equal(health.status, 200);
  });

  test("health reports the real timeout value", async () => {
    const { body } = await getJson<any>(app7.baseUrl, "/health");
    assert.equal(body.timeout.active, true);
    assert.equal(body.timeout.timeoutMs, TIMEOUT_MS);
  });
});

/* ------------------------------------------------------------------ */
/* Multi-layer protection (Part 8) — GET /api/protected                */
/* ------------------------------------------------------------------ */

describe("GET /api/protected (multi-layer)", () => {
  let app8: TestServer;
  let limiter: RateLimiterInstance;

  before(async () => {
    limiter = createRateLimiter({ max: 1000, windowMs: 60_000 });
    app8 = await startServer(
      createApp({
        demoApiKey: TEST_KEY,
        rateLimiter: limiter,
        payloadMaxKb: 1,
        timeoutMs: 300,
        protectedRateLimit: { max: 3, windowSeconds: 1 },
      }),
    );
  });

  after(async () => {
    await app8.close();
  });

  function get(path: string, headers: Record<string, string> = {}) {
    return fetch(`${app8.baseUrl}${path}`, { headers });
  }

  test("missing key → generic 401, wrong key → same 401", async () => {
    const noKey = await get("/api/protected");
    assert.equal(noKey.status, 401);
    const noKeyBody = await noKey.json();
    assert.deepEqual(noKeyBody, { success: false, error: "Unauthorized" });

    const badKey = await get("/api/protected", { "X-API-Key": "wrong-key-123" });
    assert.equal(badKey.status, 401);
    assert.deepEqual(await badKey.json(), { success: false, error: "Unauthorized" });
  });

  test("valid key passes both layers and reports them", async () => {
    const res = await get("/api/protected", { "X-API-Key": TEST_KEY });
    const body = (await res.json()) as any;

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.protection, "multi-layer");
    assert.deepEqual(body.layers, ["rate-limit", "api-key"]);
    assert.deepEqual(body.data.layersPassed, ["rate-limit", "api-key"]);
  });

  test("the shield has its own strict limit — floods hit 429 even with a valid key", async () => {
    let lastStatus = 0;
    let sawRemainingHeader = false;
    for (let i = 0; i < 5; i++) {
      const res = await get("/api/protected", { "X-API-Key": TEST_KEY });
      lastStatus = res.status;
      if (res.headers.get("x-ratelimit-remaining") !== null) sawRemainingHeader = true;
    }
    assert.equal(lastStatus, 429);
    assert.ok(sawRemainingHeader, "rate-limit headers must still be present");

    const body = (await (
      await get("/api/protected", { "X-API-Key": TEST_KEY })
    ).json()) as any;
    assert.equal(body.error, "Rate limit exceeded");
    assert.equal(typeof body.retryAfter, "number");
  });

  test("the shield window resets independently of the main lab limiter", async () => {
    // Wait out the 1s protected window.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const again = await get("/api/protected", { "X-API-Key": TEST_KEY });
    assert.equal(again.status, 200);

    // Main rate-limit lab must never have been throttled by all of this.
    limiter.reset();
    const rl = await get("/api/rate-limit");
    assert.equal(rl.status, 200);
  });

  test("layer order: a flood of bad keys gets 429 (shield first), not 401", async () => {
    for (let i = 0; i < 3; i++) {
      await get("/api/protected", { "X-API-Key": "bad-guess" });
    }
    const flooded = await get("/api/protected", { "X-API-Key": "bad-guess" });
    assert.equal(flooded.status, 429, "the shield must fire before auth checks");
  });

  test("blocked attempts across layers land in metrics as blocked", async () => {
    const beforeSnap = (await getJson<MetricsSnapshot>(app8.baseUrl, "/api/metrics")).body;

    await get("/api/protected");                                  // 401
    await get("/api/protected", { "X-API-Key": TEST_KEY });       // 429 or 200 depending on window state

    const afterSnap = (await getJson<MetricsSnapshot>(app8.baseUrl, "/api/metrics")).body;
    const deltaTotal = afterSnap.totalRequests - beforeSnap.totalRequests;
    const deltaOkOrBlocked =
      afterSnap.successfulRequests -
      beforeSnap.successfulRequests +
      (afterSnap.blockedRequests - beforeSnap.blockedRequests);
    assert.equal(deltaTotal, deltaOkOrBlocked, "every request lands in exactly one bucket");
    assert.equal(afterSnap.errorRequests - beforeSnap.errorRequests, 0);
  });
});

/* ------------------------------------------------------------------ */
/* API key issuer (Part 9) — /api/keys, 10 per 5 minutes               */
/* ------------------------------------------------------------------ */

describe("API key issuer (/api/keys)", () => {
  let app9: TestServer;
  let limiter: RateLimiterInstance;
  const KEY_MAX = 3; // tight limit so the flood test stays fast

  before(async () => {
    limiter = createRateLimiter({ max: 1000, windowMs: 60_000 });
    app9 = await startServer(
      createApp({
        demoApiKey: TEST_KEY,
        rateLimiter: limiter,
        payloadMaxKb: 1,
        timeoutMs: 300,
        protectedRateLimit: { max: 3, windowSeconds: 1 },
        keyIssueRateLimit: { max: KEY_MAX, windowSeconds: 1 },
      }),
    );
  });

  after(async () => {
    await app9.close();
  });

  async function issueKey(): Promise<{ status: number; body: any; headers: Headers }> {
    const res = await fetch(`${app9.baseUrl}/api/keys`, { method: "POST" });
    return { status: res.status, body: await res.json(), headers: res.headers };
  }

  test("issuing a key returns the full value exactly once with a display prefix", async () => {
    const { status, body } = await issueKey();

    assert.equal(status, 201);
    assert.equal(body.success, true);
    assert.equal(body.message, "API key created");
    assert.ok(body.data.key.startsWith("nxk_"), "key must use the nxk_ marker");
    assert.ok(body.data.key.length > 30, "key must have real entropy");
    assert.ok(body.data.prefix.includes("…"), "prefix is a display form");
    assert.notEqual(body.data.prefix, body.data.key);
    assert.match(String(body.data.warning), /shown once|not be shown again/i);
  });

  test("every issued key is unique", async () => {
    const a = await issueKey();
    const b = await issueKey();
    assert.notEqual(a.body.data.key, b.body.data.key);
    assert.notEqual(a.body.data.id, b.body.data.id);
  });

  test("issuance carries standard rate-limit headers", async () => {
    const { headers } = await issueKey();
    assert.notEqual(headers.get("x-ratelimit-limit"), null);
    assert.notEqual(headers.get("x-ratelimit-remaining"), null);
    assert.notEqual(headers.get("x-ratelimit-reset"), null);
  });

  test("exceeding the issuance quota gets a structured 429 with Retry-After", async () => {
    // Burn whatever remains of this window.
    for (let i = 0; i < KEY_MAX + 2; i++) {
      await issueKey();
    }
    const { status, body } = await issueKey();

    assert.equal(status, 429);
    assert.equal(body.success, false);
    assert.equal(body.error, "Rate limit exceeded");
    assert.ok(Number.isFinite(body.retryAfter));
    assert.ok(body.retryAfter >= 0);
  });

  test("the issuance window resets — unlimited keys over time", async () => {
    // Wait out the 1s test window.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const { status, body } = await issueKey();
    assert.equal(status, 201);
    assert.ok(body.data.key.startsWith("nxk_"));
  });

  test("listing shows metadata only — never full key values or hashes", async () => {
    const created = await issueKey();
    const fullKey = created.body.data.key as string;

    const res = await fetch(`${app9.baseUrl}/api/keys`);
    const rawText = await res.text();
    const parsed = JSON.parse(rawText) as any;

    assert.equal(res.status, 200);
    assert.ok(parsed.count >= 1);
    const listed = parsed.keys.find((k: any) => k.id === created.body.data.id);
    assert.ok(listed, "the new key must be listed");
    assert.ok(!rawText.includes(fullKey), "full values must never appear in listings");

    const sample = parsed.keys[0];
    for (const entry of parsed.keys) {
      assert.ok(!("hash" in entry), "hashes must never be exposed");
      assert.ok(!("key" in entry), "no full keys in list entries");
    }
    void sample;
  });

  test("issued keys authenticate on /api/auth alongside the configured demo key", async () => {
    const created = await issueKey();
    assert.equal(created.status, 201);
    const minted = created.body.data.key as string;

    const withMinted = await fetch(`${app9.baseUrl}/api/auth`, {
      headers: { "X-API-Key": minted },
    });
    assert.equal(withMinted.status, 200);
    const body = (await withMinted.json()) as any;
    assert.equal(body.protection, "api-key");

    // Demo key still works too.
    const withDemo = await fetch(`${app9.baseUrl}/api/auth`, {
      headers: { "X-API-Key": TEST_KEY },
    });
    assert.equal(withDemo.status, 200);

    // Garbage still rejected with the generic body.
    const bad = await fetch(`${app9.baseUrl}/api/auth`, {
      headers: { "X-API-Key": "nxk_totally_fake" },
    });
    assert.equal(bad.status, 401);
    assert.deepEqual(await bad.json(), { success: false, error: "Unauthorized" });
  });

  test("health reports the issuer configuration", async () => {
    const { body } = await getJson<any>(app9.baseUrl, "/health");
    assert.equal(body.keys.active, true);
    assert.equal(body.keys.max, KEY_MAX);
    assert.equal(body.keys.windowSeconds, 1);
  });
});
