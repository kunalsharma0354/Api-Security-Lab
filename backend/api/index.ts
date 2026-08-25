import { createApp } from "../src/app";

/**
 * Serverless entry point for Vercel.
 *
 * Every request is rewritten here (see vercel.json) and handed to the same
 * Express app that runs locally via `npm run dev`. The listen() call in
 * src/server.ts is intentionally bypassed — the platform owns the HTTP
 * server in this environment.
 */
const app = createApp();

export default app;
