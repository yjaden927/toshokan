import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { PrismaClient } from "../generated/prisma/client.js";
import { currentUser, requireAuth } from "./middleware.js";
import { EmailTakenError, logIn, signUp } from "./service.js";
import { SESSION_COOKIE, clearSessionCookie, createSession, deleteSession, setSessionCookie } from "./sessions.js";

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

const signupSchema = z.object({
  email,
  password: z.string().min(8).max(256),
  displayName: z.string().trim().max(80).default(""),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1).max(256),
});

export interface AuthRateLimits {
  /** Login attempts allowed per IP address in each 15-minute window. */
  login: number;
  /** Accounts that can be created per IP address in each hour. */
  signup: number;
}

const defaultRateLimits: AuthRateLimits = { login: 10, signup: 5 };

function limiter(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: "too_many_requests" });
    },
  });
}

export function authRouter({
  prisma,
  secureCookies,
  rateLimits = defaultRateLimits,
}: {
  prisma: PrismaClient;
  secureCookies: boolean;
  rateLimits?: AuthRateLimits;
}) {
  const router = Router();
  // Counts live in this process's memory. That's right for one server; running several
  // instances would need a shared store such as Redis so they enforce one limit together.
  const loginLimiter = limiter(15 * 60 * 1000, rateLimits.login);
  const signupLimiter = limiter(60 * 60 * 1000, rateLimits.signup);

  router.post("/signup", signupLimiter, async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_input", fields: z.flattenError(parsed.error).fieldErrors });
      return;
    }

    try {
      const user = await signUp(prisma, parsed.data);
      setSessionCookie(res, await createSession(prisma, user.id), secureCookies);
      res.status(201).json({ user });
    } catch (error) {
      if (error instanceof EmailTakenError) {
        res.status(409).json({ error: "email_taken" });
        return;
      }
      throw error;
    }
  });

  router.post("/login", loginLimiter, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_input", fields: z.flattenError(parsed.error).fieldErrors });
      return;
    }

    const user = await logIn(prisma, parsed.data);
    if (!user) {
      // One message for both cases, so the response doesn't reveal whether the email is registered.
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    setSessionCookie(res, await createSession(prisma, user.id), secureCookies);
    res.json({ user });
  });

  router.post("/logout", async (req, res) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === "string") await deleteSession(prisma, token);
    clearSessionCookie(res, secureCookies);
    res.status(204).end();
  });

  router.get("/me", requireAuth(prisma), (_req, res) => {
    res.json({ user: currentUser(res) });
  });

  return router;
}
