import express from "express";
import type { PrismaClient } from "./generated/prisma/client.js";

export function createApp({ prisma }: { prisma: PrismaClient }) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", database: "up" });
    } catch {
      res.status(503).json({ status: "degraded", database: "down" });
    }
  });

  return app;
}
