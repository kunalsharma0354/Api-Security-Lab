import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { DemoResponse } from "../types";

export const demoRouter = Router();

demoRouter.get("/", (_req, res) => {
  const body: DemoResponse = {
    success: true,
    message: "Demo API request processed",
    protection: "none",
    data: {
      endpoint: "/api/demo",
      method: "GET",
      processedAt: new Date().toISOString(),
      requestId: randomUUID(),
    },
  };
  res.set("Cache-Control", "no-store");
  res.status(200).json(body);
});
