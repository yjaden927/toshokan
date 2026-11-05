import { type Response, Router } from "express";
import { z } from "zod";
import { currentUser } from "../auth/middleware.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { createBookSchema, listQuerySchema, toBookResponse } from "./schema.js";
import { DuplicateBookError, InvalidBookError, createBook, listBooks } from "./service.js";

function invalidInput(res: Response, error: z.ZodError) {
  res.status(400).json({ error: "invalid_input", fields: z.flattenError(error).fieldErrors });
}

function sendServiceError(res: Response, error: unknown) {
  if (error instanceof DuplicateBookError) {
    res.status(409).json({ error: "duplicate_book" });
    return;
  }
  if (error instanceof InvalidBookError) {
    res.status(400).json({ error: "invalid_input", message: error.message });
    return;
  }
  throw error;
}

export function booksRouter({ prisma }: { prisma: PrismaClient }) {
  const router = Router();

  router.get("/", async (req, res) => {
    const query = listQuerySchema.safeParse(req.query);
    if (!query.success) return invalidInput(res, query.error);

    const books = await listBooks(prisma, currentUser(res).id, query.data);
    res.json({ books: books.map(toBookResponse) });
  });

  router.post("/", async (req, res) => {
    const input = createBookSchema.strict().safeParse(req.body);
    if (!input.success) return invalidInput(res, input.error);

    try {
      const book = await createBook(prisma, currentUser(res).id, input.data);
      res.status(201).json({ book: toBookResponse(book) });
    } catch (error) {
      sendServiceError(res, error);
    }
  });

  return router;
}
