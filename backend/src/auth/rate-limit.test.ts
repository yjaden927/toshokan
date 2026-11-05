import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createTestPrisma, resetDatabase } from "../testing/database.js";

const prisma = createTestPrisma();

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

describe("auth rate limits", () => {
  it("blocks login attempts past the limit, even with the right password", async () => {
    const app = createApp({ prisma, rateLimits: { login: 3, signup: 5 } });
    const credentials = { email: "reader@example.com", password: "correct horse battery" };
    await request(app).post("/auth/signup").send(credentials);

    for (let i = 0; i < 3; i++) {
      const res = await request(app).post("/auth/login").send({ ...credentials, password: "wrong password" });
      expect(res.status).toBe(401);
    }

    const blocked = await request(app).post("/auth/login").send(credentials);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: "too_many_requests" });
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("limits how many accounts one address can create", async () => {
    const app = createApp({ prisma, rateLimits: { login: 10, signup: 2 } });
    const signUp = (n: number) =>
      request(app).post("/auth/signup").send({ email: `reader${n}@example.com`, password: "correct horse battery" });

    expect((await signUp(1)).status).toBe(201);
    expect((await signUp(2)).status).toBe(201);
    expect((await signUp(3)).status).toBe(429);
    expect(await prisma.user.count()).toBe(2);
  });
});
