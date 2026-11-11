import { useEffect, useRef, useState } from "react";
import { Cover } from "../components/Cover";
import { Button, Input } from "../components/ui";
import { type CatalogBook, searchBooks } from "../lib/googleBooks";
import { bindingFor } from "./form";
import { catalogErrorMessage } from "./catalogMessages";

export function CatalogSearch({ onPick }: { onPick: (book: CatalogBook) => void }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CatalogBook[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const search = async () => {
    if (!term.trim()) return;
    controller.current?.abort();
    controller.current = new AbortController();
    setBusy(true);
    setError("");
    try {
      setResults(await searchBooks(term.trim(), controller.current.signal));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setResults(null);
      setError(catalogErrorMessage(e));
    }
    setBusy(false);
  };

  return (
    <section aria-label="Find the book on Google Books" className="surface rounded-[20px] p-5">
      <div className="flex gap-3">
        <Input
          type="search"
          aria-label="Search Google Books"
          placeholder="Search Google Books by title, author or ISBN"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            // The search lives inside the book form, so Enter must not submit the form.
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
        />
        <Button variant="secondary" disabled={busy} onClick={() => void search()}>
          Search
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-muted">{error}</p>}
      {results?.length === 0 && <p className="mt-3 text-sm text-muted">Nothing found. Fill in the details yourself below.</p>}
      {results && results.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {results.map((book) => (
            <li key={book.key}>
              <button
                type="button"
                onClick={() => {
                  onPick(book);
                  setResults(null);
                  setTerm("");
                }}
                className="flex w-full items-center gap-4 rounded-lg px-2 py-2.5 text-left hover:bg-sunken"
              >
                <Cover book={{ ...book, color: bindingFor(book.title) }} className="w-10 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{book.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {[book.author, book.year].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
