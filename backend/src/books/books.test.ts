import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { signUpAs } from "../testing/auth.js";
import { createTestApp } from "../testing/app.js";
import { createTestPrisma, resetDatabase } from "../testing/database.js";

const prisma = createTestPrisma();
const app = createTestApp({ prisma });

let reader: string;

beforeEach(async () => {
  await resetDatabase(prisma);
  ({ cookie: reader } = await signUpAs(app, "reader@example.com"));
});
afterAll(() => prisma.$disconnect());

const dune = { title: "Dune", author: "Frank Herbert", year: 1965, genre: "Science Fiction" };

function addBook(cookie: string, body: object) {
  return request(app).post("/books").set("Cookie", cookie).send(body);
}

describe("POST /books", () => {
  it("adds a book with defaults for everything not given", async () => {
    const res = await addBook(reader, dune);

    expect(res.status).toBe(201);
    expect(res.body.book).toMatchObject({
      ...dune,
      status: "want_to_read",
      rating: null,
      startedOn: null,
      finishedOn: null,
      color: "#36586b",
      coverUrl: null,
      coverPicked: false,
    });
    expect(res.body.book).not.toHaveProperty("userId");
  });

  it("keeps a rating and dates for a finished book", async () => {
    const res = await addBook(reader, { ...dune, status: "finished", rating: 5, startedOn: "2026-01-04", finishedOn: "2026-01-19" });

    expect(res.status).toBe(201);
    expect(res.body.book).toMatchObject({ rating: 5, startedOn: "2026-01-04", finishedOn: "2026-01-19" });
  });

  it("clears fields that don't apply to the status", async () => {
    const res = await addBook(reader, { ...dune, status: "reading", rating: 4, startedOn: "2026-01-04", finishedOn: "2026-01-19" });

    expect(res.status).toBe(201);
    expect(res.body.book).toMatchObject({ status: "reading", rating: null, startedOn: "2026-01-04", finishedOn: null });
  });

  it.each([
    ["a missing title", { author: "Frank Herbert" }],
    ["a rating of 6", { ...dune, status: "finished", rating: 6 }],
    ["an impossible date", { ...dune, status: "reading", startedOn: "2026-02-30" }],
    ["an uppercase color", { ...dune, color: "#36586B" }],
    ["a cover from another site", { ...dune, coverUrl: "https://example.com/cover.jpg" }],
    ["a plain http cover", { ...dune, coverUrl: "http://covers.openlibrary.org/b/id/1-L.jpg" }],
    ["an unknown field", { ...dune, userId: "00000000-0000-0000-0000-000000000000" }],
  ])("rejects %s", async (_case, body) => {
    const res = await addBook(reader, body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_input");
    expect(await prisma.book.count()).toBe(0);
  });

  it("rejects a finish date before the start date", async () => {
    const res = await addBook(reader, { ...dune, status: "finished", startedOn: "2026-02-01", finishedOn: "2026-01-01" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/finishedOn/);
  });

  it("accepts a Google Books cover", async () => {
    const coverUrl = "https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=3";
    const res = await addBook(reader, { ...dune, coverUrl, coverPicked: true });

    expect(res.status).toBe(201);
    expect(res.body.book).toMatchObject({ coverUrl, coverPicked: true });
  });

  it("refuses the same book twice", async () => {
    await addBook(reader, dune);
    const res = await addBook(reader, dune);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "duplicate_book" });
  });

  it("lets two readers each shelve the same book", async () => {
    const { cookie: other } = await signUpAs(app, "other@example.com");

    expect((await addBook(reader, dune)).status).toBe(201);
    expect((await addBook(other, dune)).status).toBe(201);
  });
});

describe("GET /books", () => {
  it("lists only the signed-in reader's books", async () => {
    const { cookie: other } = await signUpAs(app, "other@example.com");
    await addBook(reader, dune);
    await addBook(other, { title: "Kitchen", author: "Banana Yoshimoto" });

    const res = await request(app).get("/books").set("Cookie", reader);

    expect(res.status).toBe(200);
    expect(res.body.books.map((b: { title: string }) => b.title)).toEqual(["Dune"]);
  });

  it("filters by status and searches title and author", async () => {
    await addBook(reader, { ...dune, status: "reading" });
    await addBook(reader, { title: "Kitchen", author: "Banana Yoshimoto", status: "finished" });
    await addBook(reader, { title: "Children of Dune", author: "Frank Herbert" });

    const reading = await request(app).get("/books?status=reading").set("Cookie", reader);
    expect(reading.body.books.map((b: { title: string }) => b.title)).toEqual(["Dune"]);

    const search = await request(app).get("/books?q=herb").set("Cookie", reader);
    expect(search.body.books.map((b: { title: string }) => b.title).sort()).toEqual(["Children of Dune", "Dune"]);
  });

  it("rejects an unknown status filter", async () => {
    const res = await request(app).get("/books?status=borrowed").set("Cookie", reader);

    expect(res.status).toBe(400);
  });
});

describe("authentication", () => {
  it.each([
    ["get", "/books"],
    ["post", "/books"],
    ["get", "/books/00000000-0000-0000-0000-000000000000"],
    ["patch", "/books/00000000-0000-0000-0000-000000000000"],
    ["delete", "/books/00000000-0000-0000-0000-000000000000"],
  ] as const)("%s %s requires a session", async (method, path) => {
    const res = await request(app)[method](path);

    expect(res.status).toBe(401);
  });
});
