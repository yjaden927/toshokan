import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { type BookInput, type Status, normalizeBook, statusToDb, toDbBook } from "./schema.js";

export class DuplicateBookError extends Error {
  constructor() {
    super("This book is already on the shelf");
    this.name = "DuplicateBookError";
  }
}

export class InvalidBookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBookError";
  }
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function normalizeOrThrow(input: BookInput) {
  const result = normalizeBook(input);
  if ("error" in result) throw new InvalidBookError(result.error);
  return result.book;
}

export function listBooks(prisma: PrismaClient, userId: string, filters: { status?: Status | undefined; q?: string | undefined }) {
  return prisma.book.findMany({
    where: {
      userId,
      ...(filters.status && { status: statusToDb[filters.status] }),
      ...(filters.q && {
        OR: [
          { title: { contains: filters.q, mode: "insensitive" } },
          { author: { contains: filters.q, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createBook(prisma: PrismaClient, userId: string, input: BookInput) {
  try {
    return await prisma.book.create({ data: { ...toDbBook(normalizeOrThrow(input)), userId } });
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateBookError();
    throw error;
  }
}
