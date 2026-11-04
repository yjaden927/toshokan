import { createHash } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "../testing/app.js";
import { createTestPrisma, resetDatabase } from "../testing/database.js";
import { SESSION_COOKIE } from "./sessions.js";

const prisma = createTestPrisma();
const app = createTestApp({ prisma });

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

function sessionToken(res: request.Response) {
  const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  const cookie = cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return { cookie, token: cookie?.split(";")[0]?.split("=")[1] };
}

describe("POST /auth/signup", () => {
  it("creates the account and starts a session", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "  Reader@Example.com ", password: "correct horse battery", displayName: "Reader" });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({ id: expect.any(String), email: "reader@example.com", displayName: "Reader" });

    const { cookie, token } = sessionToken(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);

    const session = await prisma.session.findFirstOrThrow({ where: { userId: res.body.user.id } });
    expect(session.id).toBe(createHash("sha256").update(token!).digest("hex"));
    expect(session.id).not.toBe(token);
  });

  it("stores a password hash, never the password", async () => {
    await request(app).post("/auth/signup").send({ email: "a@example.com", password: "correct horse battery" });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "a@example.com" } });
    expect(user.passwordHash).toMatch(/^scrypt\$/);
    expect(user.passwordHash).not.toContain("correct horse battery");
  });

  it("never returns the password hash", async () => {
    const res = await request(app).post("/auth/signup").send({ email: "a@example.com", password: "correct horse battery" });

    expect(JSON.stringify(res.body)).not.toContain("scrypt");
  });

  it("rejects an email that is already registered, ignoring case", async () => {
    await request(app).post("/auth/signup").send({ email: "a@example.com", password: "correct horse battery" });
    const res = await request(app).post("/auth/signup").send({ email: "A@Example.com", password: "another password" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "email_taken" });
    expect(await prisma.user.count()).toBe(1);
  });

  it.each([
    ["a malformed email", { email: "not-an-email", password: "correct horse battery" }, "email"],
    ["a short password", { email: "a@example.com", password: "short" }, "password"],
    ["a missing password", { email: "a@example.com" }, "password"],
  ])("rejects %s without creating anything", async (_case, body, field) => {
    const res = await request(app).post("/auth/signup").send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_input");
    expect(res.body.fields).toHaveProperty(field);
    expect(await prisma.user.count()).toBe(0);
  });

  it("answers malformed JSON with 400", async () => {
    const res = await request(app).post("/auth/signup").set("Content-Type", "application/json").send("{not json");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "invalid_json" });
  });
});
