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

function addBook(cookie: string, body: object) {
  return request(app).post("/books").set("Cookie", cookie).send(body);
}

describe("book tags", () => {
  it("cleans up tag names: trimmed, lowercased, deduplicated and sorted", async () => {
    const res = await addBook(reader, { title: "Dune", author: "Frank Herbert", tags: ["Sci-Fi", "  Desert   Planets ", "sci-fi"] });

    expect(res.status).toBe(201);
    expect(res.body.book.tags).toEqual(["desert planets", "sci-fi"]);
  });

  it("reuses one tag across books", async () => {
    await addBook(reader, { title: "Dune", author: "Frank Herbert", tags: ["classics"] });
    await addBook(reader, { title: "Middlemarch", author: "George Eliot", tags: ["Classics"] });

    expect(await prisma.tag.count()).toBe(1);
    expect(await prisma.bookTag.count()).toBe(2);
  });

  it("keeps each reader's tags separate", async () => {
    const { cookie: other } = await signUpAs(app, "other@example.com");
    await addBook(reader, { title: "Dune", author: "Frank Herbert", tags: ["classics"] });
    await addBook(other, { title: "Dune", author: "Frank Herbert", tags: ["classics"] });

    expect(await prisma.tag.count()).toBe(2);
  });

  it("filters the shelf by tag", async () => {
    await addBook(reader, { title: "Dune", author: "Frank Herbert", tags: ["classics", "sci-fi"] });
    await addBook(reader, { title: "Kitchen", author: "Banana Yoshimoto", tags: ["short"] });

    const res = await request(app).get("/books?tag=Sci-Fi").set("Cookie", reader);

    expect(res.body.books.map((b: { title: string }) => b.title)).toEqual(["Dune"]);
  });

  it("replaces tags when a PATCH sends them and leaves them alone when it doesn't", async () => {
    const { body } = await addBook(reader, { title: "Dune", author: "Frank Herbert", tags: ["classics", "sci-fi"] });
    const id = body.book.id;

    const renamed = await request(app).patch(`/books/${id}`).set("Cookie", reader).send({ notes: "Reread soon" });
    expect(renamed.body.book.tags).toEqual(["classics", "sci-fi"]);

    const retagged = await request(app).patch(`/books/${id}`).set("Cookie", reader).send({ tags: ["favorites"] });
    expect(retagged.body.book.tags).toEqual(["favorites"]);
  });

  it.each([
    ["more than 10 tags", Array.from({ length: 11 }, (_, i) => `tag ${i}`)],
    ["a tag longer than 30 characters", ["x".repeat(31)]],
    ["an empty tag", ["   "]],
  ])("rejects %s", async (_case, tags) => {
    const res = await addBook(reader, { title: "Dune", author: "Frank Herbert", tags });

    expect(res.status).toBe(400);
    expect(await prisma.book.count()).toBe(0);
  });
});

describe("GET /tags", () => {
  it("lists the reader's tags in use, with how many books carry each", async () => {
    const { cookie: other } = await signUpAs(app, "other@example.com");
    await addBook(reader, { title: "Dune", author: "Frank Herbert", tags: ["classics", "sci-fi"] });
    const { body } = await addBook(reader, { title: "Middlemarch", author: "George Eliot", tags: ["classics", "long"] });
    await addBook(other, { title: "Kitchen", author: "Banana Yoshimoto", tags: ["short"] });
    await request(app).patch(`/books/${body.book.id}`).set("Cookie", reader).send({ tags: ["classics"] });

    const res = await request(app).get("/tags").set("Cookie", reader);

    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual([
      { name: "classics", bookCount: 2 },
      { name: "sci-fi", bookCount: 1 },
    ]);
  });

  it("requires a session", async () => {
    expect((await request(app).get("/tags")).status).toBe(401);
  });
});
