import { createApp } from "../src/app";

/**
 * Serverless entry point for Vercel.
 *
 * The Express app is created lazily inside the handler so that any
 * cold-start failure surfaces as a structured JSON response instead of an
 * opaque FUNCTION_INVOCATION_FAILED page. The listen() call in src/server.ts
 * is intentionally bypassed — the platform owns the HTTP server here.
 */
let cachedApp: ReturnType<typeof createApp> | null = null;

function getApp() {
  if (cachedApp === null) {
    cachedApp = createApp();
  }
  return cachedApp;
}

export default function handler(req: unknown, res: any) {
  try {
    return getApp()(req, res);
  } catch (err) {
    const e = err as { name?: string; message?: string; stack?: string };
    console.error("[nexora] serverless handler crashed:", e?.stack ?? e);
    if (typeof res?.status === "function" && !res.headersSent) {
      res.status(500).json({
        success: false,
        error: "Function crashed during startup",
        name: e?.name ?? "Error",
        message: e?.message ?? String(err),
        stack: (e?.stack ?? "").split("\n").slice(0, 8),
        hint: "Check DEMO_API_KEY env var is set in the Vercel project settings.",
      });
    }
  }
}
