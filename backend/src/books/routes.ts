import { type Response, Router } from "express";
import { z } from "zod";
import { currentUser } from "../auth/middleware.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { bookFields, createBookSchema, listQuerySchema, toBookResponse } from "./schema.js";
import { DuplicateBookError, InvalidBookError, createBook, deleteBook, findBook, listBooks, updateBook } from "./service.js";

const updateBookSchema = z.object(bookFields).partial().strict();
const idSchema = z.uuid();

function invalidInput(res: Response, error: z.ZodError) {
  res.status(400).json({ error: "invalid_input", fields: z.flattenError(error).fieldErrors });
}

function notFound(res: Response) {
  res.status(404).json({ error: "not_found" });
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

  router.get("/:id", async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return notFound(res);

    const book = await findBook(prisma, currentUser(res).id, id.data);
    if (!book) return notFound(res);
    res.json({ book: toBookResponse(book) });
  });

  router.patch("/:id", async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return notFound(res);
    const changes = updateBookSchema.safeParse(req.body);
    if (!changes.success) return invalidInput(res, changes.error);

    try {
      const book = await updateBook(prisma, currentUser(res).id, id.data, changes.data);
      if (!book) return notFound(res);
      res.json({ book: toBookResponse(book) });
    } catch (error) {
      sendServiceError(res, error);
    }
  });

  router.delete("/:id", async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return notFound(res);

    const deleted = await deleteBook(prisma, currentUser(res).id, id.data);
    if (!deleted) return notFound(res);
    res.status(204).end();
  });

  return router;
}
