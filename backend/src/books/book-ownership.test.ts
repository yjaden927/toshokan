import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { signUpAs } from "../testing/auth.js";
import { createTestApp } from "../testing/app.js";
import { createTestPrisma, resetDatabase } from "../testing/database.js";

const prisma = createTestPrisma();
const app = createTestApp({ prisma });

let reader: string;
let stranger: string;
let bookId: string;

beforeEach(async () => {
  await resetDatabase(prisma);
  ({ cookie: reader } = await signUpAs(app, "reader@example.com"));
  ({ cookie: stranger } = await signUpAs(app, "stranger@example.com"));
  const res = await request(app)
    .post("/books")
    .set("Cookie", reader)
    .send({ title: "Dune", author: "Frank Herbert", status: "reading", startedOn: "2026-01-04" });
  bookId = res.body.book.id;
});
afterAll(() => prisma.$disconnect());

describe("GET /books/:id", () => {
  it("returns the reader's own book", async () => {
    const res = await request(app).get(`/books/${bookId}`).set("Cookie", reader);

    expect(res.status).toBe(200);
    expect(res.body.book).toMatchObject({ id: bookId, title: "Dune" });
  });

  it("hides another reader's book as not found", async () => {
    const res = await request(app).get(`/books/${bookId}`).set("Cookie", stranger);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "not_found" });
  });

  it("answers a malformed id with 404, not a database error", async () => {
    const res = await request(app).get("/books/not-a-uuid").set("Cookie", reader);

    expect(res.status).toBe(404);
  });
});

describe("PATCH /books/:id", () => {
  it("finishes a book and keeps the existing start date", async () => {
    const res = await request(app)
      .patch(`/books/${bookId}`)
      .set("Cookie", reader)
      .send({ status: "finished", rating: 5, finishedOn: "2026-01-19" });

    expect(res.status).toBe(200);
    expect(res.body.book).toMatchObject({ status: "finished", rating: 5, startedOn: "2026-01-04", finishedOn: "2026-01-19" });
  });

  it("clears the rating when a finished book goes back to reading", async () => {
    await request(app).patch(`/books/${bookId}`).set("Cookie", reader).send({ status: "finished", rating: 4 });
    const res = await request(app).patch(`/books/${bookId}`).set("Cookie", reader).send({ status: "reading" });

    expect(res.body.book).toMatchObject({ status: "reading", rating: null, finishedOn: null });
  });

  it("rejects a finish date before the existing start date", async () => {
    const res = await request(app)
      .patch(`/books/${bookId}`)
      .set("Cookie", reader)
      .send({ status: "finished", finishedOn: "2026-01-01" });

    expect(res.status).toBe(400);
  });

  it("rejects fields that can't be changed", async () => {
    const res = await request(app).patch(`/books/${bookId}`).set("Cookie", reader).send({ id: "something-else" });

    expect(res.status).toBe(400);
  });

  it("won't change another reader's book", async () => {
    const res = await request(app).patch(`/books/${bookId}`).set("Cookie", stranger).send({ title: "Mine now" });

    expect(res.status).toBe(404);
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bookId } })).title).toBe("Dune");
  });

  it("refuses a rename that would duplicate another of the reader's books", async () => {
    await request(app).post("/books").set("Cookie", reader).send({ title: "Dune Messiah", author: "Frank Herbert" });
    const res = await request(app).patch(`/books/${bookId}`).set("Cookie", reader).send({ title: "Dune Messiah" });

    expect(res.status).toBe(409);
  });
});

describe("DELETE /books/:id", () => {
  it("removes the reader's own book", async () => {
    const res = await request(app).delete(`/books/${bookId}`).set("Cookie", reader);

    expect(res.status).toBe(204);
    expect((await request(app).get(`/books/${bookId}`).set("Cookie", reader)).status).toBe(404);
  });

  it("won't delete another reader's book", async () => {
    const res = await request(app).delete(`/books/${bookId}`).set("Cookie", stranger);

    expect(res.status).toBe(404);
    expect(await prisma.book.count({ where: { id: bookId } })).toBe(1);
  });
});
