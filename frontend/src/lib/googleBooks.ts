const ENDPOINT = "https://www.googleapis.com/books/v1/volumes";
const API_KEY: string | undefined = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY || undefined;
const FIELDS = "items(id,volumeInfo(title,authors,publisher,publishedDate,categories,imageLinks/thumbnail))";

interface Volume {
  id?: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    categories?: string[];
    imageLinks?: { thumbnail?: string };
  };
}

export interface CatalogBook {
  key: string;
  title: string;
  author: string;
  year: number | null;
  genre: string;
  publisher: string;
  coverUrl: string | null;
}

export class GoogleBooksError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(status ? `Google Books answered ${status}` : "Couldn't reach Google Books");
    this.name = "GoogleBooksError";
    this.status = status;
  }
}

/**
 * Google's thumbnail URLs come as http with a fake page-curl and the smallest size. The API
 * only accepts https covers, and zoom=3 is the largest scan; Cover falls back to zoom=1 when
 * a volume has no large one.
 */
export function toCoverUrl(thumbnail: string) {
  return thumbnail.replace(/^http:/, "https:").replace("&edge=curl", "").replace("&zoom=1", "&zoom=3");
}

/** Lowercase, no accents or punctuation, no leading article, no subtitle. */
export function normalizeTitle(title: string) {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[:(]/)[0]!
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/^(the|a|an) /, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toCatalogBook(volume: Volume, index: number): CatalogBook | null {
  const info = volume.volumeInfo;
  if (!info?.title) return null;
  const year = Number.parseInt(info.publishedDate?.slice(0, 4) ?? "", 10);
  return {
    key: volume.id ?? `volume-${index}`,
    title: info.title.slice(0, 200),
    author: (info.authors ?? []).slice(0, 2).join(" & ").slice(0, 200),
    year: Number.isFinite(year) ? year : null,
    genre: info.categories?.[0]?.split("/")[0]?.trim().slice(0, 40) || "Other",
    publisher: info.publisher ?? "",
    coverUrl: info.imageLinks?.thumbnail ? toCoverUrl(info.imageLinks.thumbnail) : null,
  };
}

async function fetchVolumes(q: string, maxResults: number, signal?: AbortSignal) {
  const params = new URLSearchParams({ q, printType: "books", maxResults: String(maxResults), fields: FIELDS });
  if (API_KEY) params.set("key", API_KEY);
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?${params}`, signal ? { signal } : {});
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new GoogleBooksError(0);
  }
  if (!res.ok) throw new GoogleBooksError(res.status);
  const data = (await res.json()) as { items?: Volume[] };
  return (data.items ?? []).map(toCatalogBook).filter((book): book is CatalogBook => book !== null);
}

/** Free-text search to fill in a new book's details. Editions of the same book appear once. */
export async function searchBooks(term: string, signal?: AbortSignal) {
  const seen = new Set<string>();
  return (await fetchVolumes(term, 10, signal))
    .filter((book) => {
      const key = `${normalizeTitle(book.title)}|${book.author.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

/**
 * Every edition of this book that has a cover, for the cover picker. Search results often
 * include study guides and other books that mention the title, so the title has to match.
 */
export async function findEditions(title: string, author: string, signal?: AbortSignal) {
  const wanted = normalizeTitle(title);
  const seen = new Set<string>();
  return (await fetchVolumes(`intitle:${title} inauthor:${author}`, 40, signal)).filter((book) => {
    if (!book.coverUrl || normalizeTitle(book.title) !== wanted || seen.has(book.coverUrl)) return false;
    seen.add(book.coverUrl);
    return true;
  });
}
