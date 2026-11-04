import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import type { PrismaClient } from "./generated/prisma/client.js";

function appWithDatabase(queryRaw: () => Promise<unknown>) {
  const prisma = { $queryRaw: vi.fn(queryRaw) } as unknown as PrismaClient;
  return createApp({ prisma });
}

describe("GET /health", () => {
  it("reports the database as up when it answers", async () => {
    const res = await request(appWithDatabase(() => Promise.resolve([{ "?column?": 1 }]))).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", database: "up" });
  });

  it("returns 503 when the database is unreachable", async () => {
    const res = await request(appWithDatabase(() => Promise.reject(new Error("connection refused")))).get("/health");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "degraded", database: "down" });
  });

  it("does not advertise the framework", async () => {
    const res = await request(appWithDatabase(() => Promise.resolve([]))).get("/health");

    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
