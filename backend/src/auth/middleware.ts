import type { RequestHandler, Response } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { AuthUser } from "./service.js";
import { SESSION_COOKIE, findSessionUser } from "./sessions.js";

declare global {
  namespace Express {
    interface Locals {
      user?: AuthUser;
    }
  }
}

export function requireAuth(prisma: PrismaClient): RequestHandler {
  return async (req, res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    const user = typeof token === "string" ? await findSessionUser(prisma, token) : null;
    if (!user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    res.locals.user = user;
    next();
  };
}

export function currentUser(res: Response): AuthUser {
  const { user } = res.locals;
  if (!user) throw new Error("currentUser() called on a route without requireAuth");
  return user;
}
