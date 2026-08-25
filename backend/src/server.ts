import { createApp } from "./app";
import { env } from "./config/env";

// The authentication lab is part of this application, so a missing demo key
// is a configuration error: refuse to start rather than boot with the lab
// silently disabled. (The value is a public demo key from .env.example —
// never a real secret.)
if (!env.demoApiKey) {
  console.error(
    "[nexora] CONFIGURATION ERROR: DEMO_API_KEY is not set.\n" +
      "         The API-key authentication lab requires it.\n" +
      "         Fix: add DEMO_API_KEY to backend/.env (see backend/.env.example).",
  );
  process.exit(1);
}

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(`[nexora] backend listening on http://localhost:${env.port}`);
  console.log(`[nexora] environment: ${env.nodeEnv}`);
  console.log(`[nexora] CORS origin:   ${env.frontendOrigin}`);
  console.log("[nexora] auth lab:      configured");
});

function shutdown(signal: string): void {
  console.log(`[nexora] ${signal} received, shutting down…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
