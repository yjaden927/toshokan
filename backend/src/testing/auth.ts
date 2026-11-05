import request from "supertest";
import type { Express } from "express";
import { SESSION_COOKIE } from "../auth/sessions.js";

export async function signUpAs(app: Express, email: string) {
  const res = await request(app).post("/auth/signup").send({ email, password: "correct horse battery" });
  const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  const cookie = cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.split(";")[0];
  if (!cookie) throw new Error(`Sign-up for ${email} failed with ${res.status}`);
  return { cookie, userId: res.body.user.id as string };
}
