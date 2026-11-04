import { createHash, randomBytes } from "node:crypto";
import type { Response } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";

export const SESSION_COOKIE = "toshokan_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// The cookie carries a random token; the database only stores its SHA-256, so a leaked
// sessions table can't be replayed as logins.
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(prisma: PrismaClient, userId: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: { id: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  return token;
}

export function setSessionCookie(res: Response, token: string, secure: boolean) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookie(res: Response, secure: boolean) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure, sameSite: "lax", path: "/" });
}

export async function findSessionUser(prisma: PrismaClient, token: string) {
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    select: { expiresAt: true, user: { select: { id: true, email: true, displayName: true } } },
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await prisma.session.deleteMany({ where: { id: hashToken(token) } });
    return null;
  }
  return session.user;
}

export async function deleteSession(prisma: PrismaClient, token: string) {
  await prisma.session.deleteMany({ where: { id: hashToken(token) } });
}
