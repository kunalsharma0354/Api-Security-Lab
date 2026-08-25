import "dotenv/config";

function readPort(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid ${name} value: "${raw}"`);
  }
  return parsed;
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name} value: "${raw}" (must be a positive integer)`);
  }
  return parsed;
}

function readOptionalSecret(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const nodeEnv = process.env.NODE_ENV ?? "development";

export const env = {
  nodeEnv,
  isDevelopment: nodeEnv === "development",
  port: readPort("PORT", 3001),
  /**
   * Comma-separated allow-list of browser origins that may call this API
   * (local dev + the deployed Vercel frontend). Trailing slashes and case
   * are ignored at comparison time.
   */
  frontendOrigins: (
    process.env.FRONTEND_ORIGIN ??
    "http://localhost:5173,https://nexoralab-phi.vercel.app"
  )
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter((value) => value.length > 0),
  rateLimit: {
    max: readPositiveInt("RATE_LIMIT_MAX", 10),
    windowSeconds: readPositiveInt("RATE_LIMIT_WINDOW_SECONDS", 60),
  },
  /**
   * Development/demo API key for the authentication lab.
   * Undefined means the lab is not configured — the server refuses to
   * start in that case (see server.ts) because the auth lab is enabled.
   */
  demoApiKey: readOptionalSecret("DEMO_API_KEY"),
  /** Request-size lab: maximum accepted JSON body size in kilobytes. */
  payloadMaxKb: readPositiveInt("PAYLOAD_MAX_KB", 64),
  /** Timeout lab: requests slower than this are cut off with a 504. */
  timeoutMs: readPositiveInt("TIMEOUT_MS", 2000),
  /** Multi-layer lab: its own, stricter limiter instance. */
  protectedRateLimit: {
    max: readPositiveInt("PROTECTED_RATE_LIMIT_MAX", 5),
    windowSeconds: readPositiveInt("PROTECTED_RATE_LIMIT_WINDOW_SECONDS", 60),
  },
  /** Key issuer: unlimited keys, throttled issuance. */
  keyIssue: {
    max: readPositiveInt("KEY_ISSUE_MAX", 10),
    windowSeconds: readPositiveInt("KEY_ISSUE_WINDOW_SECONDS", 300),
  },
} as const;

export type Env = typeof env;
