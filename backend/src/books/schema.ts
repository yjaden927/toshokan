import { z } from "zod";
import type { Prisma, ReadingStatus } from "../generated/prisma/client.js";

export const STATUSES = ["want_to_read", "reading", "finished"] as const;
export type Status = (typeof STATUSES)[number];

const toDb: Record<Status, ReadingStatus> = { want_to_read: "WANT_TO_READ", reading: "READING", finished: "FINISHED" };
const fromDb: Record<ReadingStatus, Status> = { WANT_TO_READ: "want_to_read", READING: "reading", FINISHED: "finished" };

// Covers are shown as <img src>, so only the catalogs the app looks covers up in are
// accepted. Anything else could point readers' browsers at an arbitrary server.
const COVER_HOSTS = new Set(["books.google.com", "books.googleusercontent.com", "covers.openlibrary.org"]);

const coverUrl = z
  .url({ protocol: /^https$/ })
  .max(1000)
  .refine((url) => COVER_HOSTS.has(new URL(url).hostname), "Covers must come from Google Books or Open Library");

const isoDate = z.iso.date();

export const tagName = z
  .string()
  .transform((name) => name.trim().toLowerCase().replace(/\s+/g, " "))
  .pipe(z.string().min(1).max(30));

export const withTags = { tags: { select: { tag: { select: { name: true } } } } } as const;

export type BookWithTags = Prisma.BookGetPayload<{ include: typeof withTags }>;

export const bookFields = {
  title: z.string().trim().min(1, "Enter the title").max(200),
  author: z.string().trim().min(1, "Enter the author").max(200),
  year: z.number().int().min(1).max(9999).nullable(),
  genre: z.string().trim().min(1).max(40),
  status: z.enum(STATUSES),
  rating: z.number().int().min(1).max(5).nullable(),
  startedOn: isoDate.nullable(),
  finishedOn: isoDate.nullable(),
  synopsis: z.string().trim().max(3000),
  notes: z.string().trim().max(3000),
  color: z.string().regex(/^#[0-9a-f]{6}$/, "Use a lowercase hex color like #36586b"),
  coverUrl: coverUrl.nullable(),
  coverPicked: z.boolean(),
  tags: z
    .array(tagName)
    .max(10)
    .transform((names) => [...new Set(names)]),
};

export const createBookSchema = z.object({
  ...bookFields,
  year: bookFields.year.default(null),
  genre: bookFields.genre.default("Other"),
  status: bookFields.status.default("want_to_read"),
  rating: bookFields.rating.default(null),
  startedOn: bookFields.startedOn.default(null),
  finishedOn: bookFields.finishedOn.default(null),
  synopsis: bookFields.synopsis.default(""),
  notes: bookFields.notes.default(""),
  color: bookFields.color.default("#36586b"),
  coverUrl: bookFields.coverUrl.default(null),
  coverPicked: bookFields.coverPicked.default(false),
  tags: bookFields.tags.default([]),
});

export type BookInput = z.infer<typeof createBookSchema>;

/**
 * A rating and finish date only mean something for a finished book, and a start date
 * only once reading has begun, so fields that don't apply to the status are cleared
 * rather than rejected. Dates out of order are a real mistake and are reported.
 */
export function normalizeBook(book: BookInput): { book: BookInput } | { error: string } {
  const finished = book.status === "finished";
  const started = book.status !== "want_to_read";
  const normalized = {
    ...book,
    rating: finished ? book.rating : null,
    finishedOn: finished ? book.finishedOn : null,
    startedOn: started ? book.startedOn : null,
  };
  if (normalized.startedOn && normalized.finishedOn && normalized.startedOn > normalized.finishedOn) {
    return { error: "finishedOn must be on or after startedOn" };
  }
  return { book: normalized };
}

const toDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`) : null);
const toIso = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);

/** The book's own columns. Tags live in their own tables and are written separately. */
export function toDbBook({ tags: _, ...book }: BookInput) {
  return { ...book, status: toDb[book.status], startedOn: toDate(book.startedOn), finishedOn: toDate(book.finishedOn) };
}

export function fromDbBook(book: BookWithTags): BookInput {
  return {
    title: book.title,
    author: book.author,
    year: book.year,
    genre: book.genre,
    status: fromDb[book.status],
    rating: book.rating,
    startedOn: toIso(book.startedOn),
    finishedOn: toIso(book.finishedOn),
    synopsis: book.synopsis,
    notes: book.notes,
    color: book.color,
    coverUrl: book.coverUrl,
    coverPicked: book.coverPicked,
    tags: book.tags.map(({ tag }) => tag.name).sort(),
  };
}

/** What the API returns: every field the client shows, and nothing it doesn't need, such as userId. */
export function toBookResponse(book: BookWithTags) {
  return {
    id: book.id,
    ...fromDbBook(book),
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
  };
}

export const listQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  q: z.string().trim().max(200).optional(),
  tag: tagName.optional(),
});

export { toDb as statusToDb };
