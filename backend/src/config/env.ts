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
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
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
} as const;

export type Env = typeof env;
