import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "../testing/app.js";
import { createTestPrisma, resetDatabase } from "../testing/database.js";
import { SESSION_COOKIE, hashToken } from "./sessions.js";

const prisma = createTestPrisma();
const app = createTestApp({ prisma });

const credentials = { email: "reader@example.com", password: "correct horse battery" };

beforeEach(async () => {
  await resetDatabase(prisma);
  await request(app).post("/auth/signup").send({ ...credentials, displayName: "Reader" });
});
afterAll(() => prisma.$disconnect());

function sessionCookie(res: request.Response) {
  const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  return cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.split(";")[0];
}

async function logIn() {
  const res = await request(app).post("/auth/login").send(credentials);
  return sessionCookie(res)!;
}

describe("POST /auth/login", () => {
  it("starts a new session for the right password", async () => {
    const res = await request(app).post("/auth/login").send({ ...credentials, email: "Reader@Example.com" });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: "reader@example.com", displayName: "Reader" });
    expect(sessionCookie(res)).toBeDefined();
    expect(JSON.stringify(res.body)).not.toContain("scrypt");
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const wrongPassword = await request(app).post("/auth/login").send({ ...credentials, password: "wrong password" });
    const unknownEmail = await request(app).post("/auth/login").send({ ...credentials, email: "nobody@example.com" });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "invalid_credentials" });
      expect(sessionCookie(res)).toBeUndefined();
    }
  });
});

describe("GET /auth/me", () => {
  it("returns the signed-in user", async () => {
    const res = await request(app).get("/auth/me").set("Cookie", await logIn());

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: "reader@example.com" });
  });

  it("rejects requests without a session", async () => {
    const res = await request(app).get("/auth/me");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "unauthenticated" });
  });

  it("rejects a made-up token", async () => {
    const res = await request(app).get("/auth/me").set("Cookie", `${SESSION_COOKIE}=not-a-real-token`);

    expect(res.status).toBe(401);
  });

  it("rejects an expired session and removes it", async () => {
    const cookie = await logIn();
    const token = cookie.split("=")[1]!;
    await prisma.session.update({ where: { id: hashToken(token) }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await request(app).get("/auth/me").set("Cookie", cookie);

    expect(res.status).toBe(401);
    expect(await prisma.session.findUnique({ where: { id: hashToken(token) } })).toBeNull();
  });
});

describe("POST /auth/logout", () => {
  it("ends the session on the server, not just in the browser", async () => {
    const cookie = await logIn();

    const res = await request(app).post("/auth/logout").set("Cookie", cookie);
    expect(res.status).toBe(204);
    expect(([] as string[]).concat(res.headers["set-cookie"] ?? []).join()).toMatch(/Expires=Thu, 01 Jan 1970/);

    const after = await request(app).get("/auth/me").set("Cookie", cookie);
    expect(after.status).toBe(401);
  });

  it("succeeds without a session", async () => {
    const res = await request(app).post("/auth/logout");

    expect(res.status).toBe(204);
  });
});
