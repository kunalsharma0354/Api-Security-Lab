import { Router } from "express";
import type {
  AuthHealth,
  HealthResponse,
  RateLimiterHealth,
} from "../types";
import { env } from "../config/env";

export interface HealthRouterConfig {
  rateLimiter: RateLimiterHealth;
  auth: AuthHealth;
  payloadMaxKb: number;
  timeoutMs: number;
}

export function createHealthRouter(config: HealthRouterConfig): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    // NOTE: reports only *whether* protection is configured — never any
    // secret material such as the demo API key itself.
    const body: Omit<HealthResponse, "timestamp"> & { timestamp: string } = {
      status: "ok",
      service: "NEXORA API Security Lab",
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
      rateLimiter: config.rateLimiter,
      auth: config.auth,
      payload: { active: true, maxKb: config.payloadMaxKb },
      timeout: { active: true, timeoutMs: config.timeoutMs },
    };
    res.set("Cache-Control", "no-store");
    res.json(body);
  });

  return router;
}
