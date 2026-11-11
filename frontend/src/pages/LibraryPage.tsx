import clsx from "clsx";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AppHeader } from "../components/AppHeader";
import { buttonClass } from "../components/buttonStyles";
import { Cover } from "../components/Cover";
import { Input } from "../components/ui";
import { type Book, type Status, type TagCount, books as booksApi, tags as tagsApi } from "../lib/api";

const TABS: { status: Status | undefined; label: string }[] = [
  { status: undefined, label: "All" },
  { status: "reading", label: "Reading" },
  { status: "want_to_read", label: "Want to read" },
  { status: "finished", label: "Finished" },
];

function parseStatus(value: string | null): Status | undefined {
  return value === "reading" || value === "want_to_read" || value === "finished" ? value : undefined;
}

export function LibraryPage() {
  // Filters live in the URL, so a filtered shelf survives a reload and can be bookmarked.
  const [params, setParams] = useSearchParams();
  const status = parseStatus(params.get("status"));
  const q = params.get("q") ?? "";
  const tag = params.get("tag") ?? undefined;

  const [search, setSearch] = useState(q);
  const [shelf, setShelf] = useState<Book[] | null>(null);
  const [tagCounts, setTagCounts] = useState<TagCount[]>([]);
  const [failed, setFailed] = useState(false);

  const setFilter = (key: "status" | "q" | "tag", value: string | undefined) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: key === "q" },
    );
  };

  // Searching waits for a pause in typing so each keystroke doesn't send a request.
  useEffect(() => {
    if (search.trim() === q) return;
    const timer = setTimeout(() => setFilter("q", search.trim() || undefined), 250);
    return () => clearTimeout(timer);
  });

  useEffect(() => {
    let current = true;
    booksApi
      .list({ status, q: q || undefined, tag })
      .then((result) => {
        if (!current) return;
        setShelf(result);
        setFailed(false);
      })
      .catch(() => current && setFailed(true));
    // A slower response for an older filter must not overwrite a newer one.
    return () => {
      current = false;
    };
  }, [status, q, tag]);

  useEffect(() => {
    tagsApi.list().then(setTagCounts, () => setTagCounts([]));
  }, []);

  const filtered = Boolean(status || q || tag);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <AppHeader />

      <div className="mt-14 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">Your library</h1>
          {shelf && (
            <p className="mt-1 text-sm text-muted">
              {shelf.length} {shelf.length === 1 ? "book" : "books"}
              {filtered && (shelf.length === 1 ? " matches" : " match")}
            </p>
          )}
        </div>
        <div className="flex w-full gap-3 sm:w-auto">
          <Input
            type="search"
            aria-label="Search by title or author"
            placeholder="Search title or author"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:w-72"
          />
          <Link to="/books/new" className={buttonClass("primary", "shrink-0")}>
            Add a book
          </Link>
        </div>
      </div>

      <nav aria-label="Reading status" className="mt-10 flex gap-1 border-b border-line">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            type="button"
            aria-current={status === tab.status ? "page" : undefined}
            onClick={() => setFilter("status", tab.status)}
            className={clsx(
              "-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors duration-150",
              status === tab.status ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {tagCounts.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Filter by tag">
          {tagCounts.map((t) => (
            <button
              key={t.name}
              type="button"
              aria-pressed={tag === t.name}
              onClick={() => setFilter("tag", tag === t.name ? undefined : t.name)}
              className={clsx(
                "rounded-full border px-3 py-1 text-xs transition-colors duration-150",
                tag === t.name ? "border-accent bg-accent-soft text-ink" : "border-line text-muted hover:text-ink",
              )}
            >
              {t.name} <span className="text-faint">{t.bookCount}</span>
            </button>
          ))}
        </div>
      )}

      <section className="mt-8">
        {failed ? (
          <p className="text-muted">Couldn't load your shelf. Refresh to try again.</p>
        ) : shelf === null ? (
          <p className="text-muted">Loading your shelf…</p>
        ) : shelf.length === 0 ? (
          <p className="text-muted">{filtered ? "No books match these filters." : "Your shelf is empty. Add a book to get started."}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {shelf.map((book) => (
              <li key={book.id}>
                <Link to={`/books/${book.id}`} className="group block">
                  <Cover book={book} className="transition-transform duration-200 ease-smooth group-hover:-translate-y-1" />
                  <p className="mt-3 line-clamp-2 text-sm font-medium leading-snug">{book.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{book.author}</p>
                  {book.rating && (
                    <p className="mt-1 text-xs text-accent" aria-label={`Rated ${book.rating} out of 5`}>
                      {"★".repeat(book.rating)}
                      <span className="text-faint">{"★".repeat(5 - book.rating)}</span>
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
