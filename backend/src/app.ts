import cookieParser from "cookie-parser";
import express, { type ErrorRequestHandler } from "express";
import { type AuthRateLimits, authRouter } from "./auth/routes.js";
import type { PrismaClient } from "./generated/prisma/client.js";

export interface AppOptions {
  prisma: PrismaClient;
  secureCookies?: boolean;
  rateLimits?: AuthRateLimits;
}

export function createApp({ prisma, secureCookies = true, rateLimits }: AppOptions) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", database: "up" });
    } catch {
      res.status(503).json({ status: "degraded", database: "down" });
    }
  });

  app.use("/auth", authRouter({ prisma, secureCookies, rateLimits }));

  app.use(errorHandler);

  return app;
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ error: "invalid_json" });
    return;
  }
  if (error?.type === "entity.too.large") {
    res.status(413).json({ error: "payload_too_large" });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "internal_error" });
};
