import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleBooksError, findEditions, normalizeTitle, searchBooks, toCoverUrl } from "./googleBooks";

function volumes(items: object[], status = 200) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ items }), { status })));
}

const volume = (id: string, title: string, extra: object = {}) => ({
  id,
  volumeInfo: {
    title,
    authors: ["Frank Herbert"],
    publishedDate: "1965-08-01",
    categories: ["Fiction / Science Fiction / General"],
    imageLinks: { thumbnail: `http://books.google.com/books/content?id=${id}&printsec=frontcover&img=1&zoom=1&edge=curl` },
    ...extra,
  },
});

afterEach(() => vi.unstubAllGlobals());

describe("toCoverUrl", () => {
  it("makes the thumbnail https, drops the page curl and asks for the largest size", () => {
    expect(toCoverUrl("http://books.google.com/books/content?id=x&printsec=frontcover&img=1&zoom=1&edge=curl")).toBe(
      "https://books.google.com/books/content?id=x&printsec=frontcover&img=1&zoom=3",
    );
  });
});

describe("normalizeTitle", () => {
  it("ignores case, accents, punctuation, a leading article and the subtitle", () => {
    expect(normalizeTitle("The Name of the Rosé: A Novel")).toBe("name of the rose");
  });
});

describe("searchBooks", () => {
  it("maps volumes to book details", async () => {
    volumes([volume("a", "Dune")]);

    expect(await searchBooks("dune")).toEqual([
      {
        key: "a",
        title: "Dune",
        author: "Frank Herbert",
        year: 1965,
        genre: "Fiction",
        publisher: "",
        coverUrl: "https://books.google.com/books/content?id=a&printsec=frontcover&img=1&zoom=3",
      },
    ]);
  });

  it("shows each book once even when several editions match", async () => {
    volumes([volume("a", "Dune"), volume("b", "Dune"), volume("c", "Dune Messiah")]);

    expect((await searchBooks("dune")).map((b) => b.key)).toEqual(["a", "c"]);
  });

  it("reports Google's status when it refuses", async () => {
    volumes([], 429);

    await expect(searchBooks("dune")).rejects.toEqual(new GoogleBooksError(429));
  });
});

describe("findEditions", () => {
  it("keeps editions of this book with a cover, skipping other books and duplicates", async () => {
    volumes([
      volume("a", "Dune"),
      volume("b", "Dune: Deluxe Edition"),
      volume("c", "Dune Messiah"),
      volume("d", "Study Guide for Dune"),
      volume("e", "Dune", { imageLinks: undefined }),
      volume("a", "Dune"),
    ]);

    expect((await findEditions("Dune", "Frank Herbert")).map((b) => b.key)).toEqual(["a", "b"]);
  });
});
