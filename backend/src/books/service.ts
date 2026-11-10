import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { type BookInput, type Status, fromDbBook, normalizeBook, statusToDb, toDbBook, withTags } from "./schema.js";

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

function isNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

// Tags are per reader, so "classics" on two of my books is one row, and connectOrCreate
// reuses it instead of creating a duplicate.
function tagLinks(userId: string, names: string[]) {
  return names.map((name) => ({
    tag: { connectOrCreate: { where: { userId_name: { userId, name } }, create: { userId, name } } },
  }));
}

function normalizeOrThrow(input: BookInput) {
  const result = normalizeBook(input);
  if ("error" in result) throw new InvalidBookError(result.error);
  return result.book;
}

export function listBooks(
  prisma: PrismaClient,
  userId: string,
  filters: { status?: Status | undefined; q?: string | undefined; tag?: string | undefined },
) {
  return prisma.book.findMany({
    where: {
      userId,
      ...(filters.status && { status: statusToDb[filters.status] }),
      ...(filters.tag && { tags: { some: { tag: { name: filters.tag } } } }),
      ...(filters.q && {
        OR: [
          { title: { contains: filters.q, mode: "insensitive" } },
          { author: { contains: filters.q, mode: "insensitive" } },
        ],
      }),
    },
    include: withTags,
    orderBy: { updatedAt: "desc" },
  });
}

export async function createBook(prisma: PrismaClient, userId: string, input: BookInput) {
  try {
    const book = normalizeOrThrow(input);
    return await prisma.book.create({
      data: { ...toDbBook(book), userId, tags: { create: tagLinks(userId, book.tags) } },
      include: withTags,
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateBookError();
    throw error;
  }
}

// Every lookup below filters by userId as well as id. Another reader's book is reported as
// missing rather than forbidden, so ids can't be probed to learn what exists.
export function findBook(prisma: PrismaClient, userId: string, id: string) {
  return prisma.book.findFirst({ where: { id, userId }, include: withTags });
}

export async function updateBook(prisma: PrismaClient, userId: string, id: string, changes: Partial<BookInput>) {
  const existing = await findBook(prisma, userId, id);
  if (!existing) return null;

  const merged = normalizeOrThrow({ ...fromDbBook(existing), ...changes });
  try {
    return await prisma.book.update({
      where: { id, userId },
      data: {
        ...toDbBook(merged),
        // Only rewrite tags when the request sent them, so editing a title doesn't touch them.
        ...(changes.tags && { tags: { deleteMany: {}, create: tagLinks(userId, merged.tags) } }),
      },
      include: withTags,
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateBookError();
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function deleteBook(prisma: PrismaClient, userId: string, id: string) {
  const { count } = await prisma.book.deleteMany({ where: { id, userId } });
  return count > 0;
}

/** The reader's tags that are on at least one book, with how many books each is on. */
export async function listTags(prisma: PrismaClient, userId: string) {
  const tags = await prisma.tag.findMany({
    where: { userId, books: { some: {} } },
    select: { name: true, _count: { select: { books: true } } },
    orderBy: { name: "asc" },
  });
  return tags.map((tag) => ({ name: tag.name, bookCount: tag._count.books }));
}
