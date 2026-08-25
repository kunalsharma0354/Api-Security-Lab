import cors from "cors";
import express, { type Express } from "express";
import { env } from "./config/env";
import { requestLogger } from "./middleware/requestLogger";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import {
  createRateLimiter,
  type RateLimiterInstance,
} from "./middleware/rateLimiter";
import { createHealthRouter } from "./routes/health";
import { demoRouter } from "./routes/demo";
import { metricsRouter } from "./routes/metrics";
import { logsRouter } from "./routes/logs";
import { createRateLimitRouter } from "./routes/rateLimit";
import { validationRouter } from "./routes/validation";
import { createPayloadRouter } from "./routes/payload";
import { createTimeoutRouter } from "./routes/timeout";
import { createProtectedRouter } from "./routes/protected";
import {
  authNotConfiguredHandler,
  createAuthRouter,
} from "./routes/auth";
import {
  malformedJsonBlocker,
} from "./middleware/inputValidation";
import { createApiKeyAuth } from "./middleware/apiKeyAuth";

export interface AppOptions {
  /** Inject a custom limiter instance (used by tests for isolation). */
  rateLimiter?: RateLimiterInstance;
  /** Inject the demo API key (used by tests; defaults to env.DEMO_API_KEY). */
  demoApiKey?: string;
  /** Payload-lab limit override in KB (tests use small values). */
  payloadMaxKb?: number;
  /** Timeout-lab deadline override in ms (tests use fast values). */
  timeoutMs?: number;
  /** Protected-lab limiter overrides (tests use tight/fast windows). */
  protectedRateLimit?: { max?: number; windowSeconds?: number };
}

function createDefaultRateLimiter(): RateLimiterInstance {
  return createRateLimiter({
    max: env.rateLimit.max,
    windowMs: env.rateLimit.windowSeconds * 1000,
  });
}

export function createApp(options: AppOptions = {}): Express {
  const limiter = options.rateLimiter ?? createDefaultRateLimiter();
  // An explicit `demoApiKey: undefined` override forces the lab into the
  // unconfigured state (used by tests), independent of any local .env file.
  const demoApiKey =
    Object.prototype.hasOwnProperty.call(options, "demoApiKey")
      ? options.demoApiKey
      : env.demoApiKey;
  const authConfigured =
    typeof demoApiKey === "string" && demoApiKey.length > 0;

  const payloadMaxBytes =
    (options.payloadMaxKb ?? env.payloadMaxKb) * 1024;
  const timeoutMs = options.timeoutMs ?? env.timeoutMs;
  const protectedLimiter = createRateLimiter({
    max: options.protectedRateLimit?.max ?? env.protectedRateLimit.max,
    windowMs:
      (options.protectedRateLimit?.windowSeconds ??
        env.protectedRateLimit.windowSeconds) * 1000,
  });

  const app = express();

  app.disable("x-powered-by");

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origin === env.frontendOrigin) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      methods: ["GET", "POST", "OPTIONS"],
      credentials: false,
    }),
  );

  app.use(requestLogger);

  // Scoped parsers run BEFORE the global one so each lab controls how its
  // own bodies fail. (body-parser skips re-parsing when already done.)
  app.use(
    "/api/validate",
    express.json({ limit: "256kb" }),
    malformedJsonBlocker,
  );
  app.use("/api/payload", createPayloadRouter(payloadMaxBytes));

  app.use(express.json({ limit: "256kb" }));

  app.use(
    "/health",
    createHealthRouter({
      rateLimiter: {
        active: true,
        max: limiter.options.max,
        windowSeconds: Math.round(limiter.options.windowMs / 1000),
      },
      auth: { active: authConfigured },
      payloadMaxKb: Math.round(payloadMaxBytes / 1024),
      timeoutMs,
    }),
  );
  app.use("/api/demo", demoRouter);
  app.use("/api/rate-limit", createRateLimitRouter(limiter));
  app.use("/api/validate", validationRouter);
  app.use("/api/timeout", createTimeoutRouter(timeoutMs));
  app.use(
    "/api/protected",
    authConfigured
      ? createProtectedRouter({
          limiter: protectedLimiter,
          apiKey: demoApiKey as string,
        })
      : authNotConfiguredHandler(),
  );
  app.use(
    "/api/auth",
    createAuthRouter(
      authConfigured ? createApiKeyAuth({ apiKey: demoApiKey as string }) : authNotConfiguredHandler(),
    ),
  );
  app.use("/api/metrics", metricsRouter);
  app.use("/api/logs", logsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
