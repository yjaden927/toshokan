import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "../generated/prisma/client.js";
import { EmailTakenError, signUp } from "./service.js";
import { createSession, setSessionCookie } from "./sessions.js";

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(8).max(256),
  displayName: z.string().trim().max(80).default(""),
});

export function authRouter({ prisma, secureCookies }: { prisma: PrismaClient; secureCookies: boolean }) {
  const router = Router();

  router.post("/signup", async (req, res) => {
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

  return router;
}
