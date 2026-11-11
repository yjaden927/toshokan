import clsx from "clsx";
import { useEffect, useState } from "react";
import { Cover } from "../components/Cover";
import { Button } from "../components/ui";
import { type CatalogBook, findEditions } from "../lib/googleBooks";
import { catalogErrorMessage } from "./catalogMessages";

type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "done"; editions: CatalogBook[] };

/** Every edition's cover from Google Books, so a reader can pick the one on their own shelf. */
export function CoverPicker({
  title,
  author,
  current,
  onPick,
  onClose,
}: {
  title: string;
  author: string;
  current: string | null;
  onPick: (coverUrl: string) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    findEditions(title, author, controller.signal)
      .then((editions) => setState({ kind: "done", editions }))
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setState({ kind: "error", message: catalogErrorMessage(e) });
      });
    return () => controller.abort();
  }, [title, author]);

  return (
    <section aria-label="Choose a cover" className="surface rounded-[20px] p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium">Covers for {title}</h2>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      {state.kind === "loading" && <p className="mt-3 text-sm text-muted">Looking up editions…</p>}
      {state.kind === "error" && <p className="mt-3 text-sm text-muted">{state.message}</p>}
      {state.kind === "done" && state.editions.length === 0 && (
        <p className="mt-3 text-sm text-muted">Google Books has no covers for this title and author. Check the spelling.</p>
      )}
      {state.kind === "done" && state.editions.length > 0 && (
        <ul className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-5">
          {state.editions.map((edition) => (
            <li key={edition.key}>
              <button
                type="button"
                aria-pressed={edition.coverUrl === current}
                aria-label={`Use the ${[edition.year, edition.publisher].filter(Boolean).join(" ") || "this"} edition's cover`}
                onClick={() => edition.coverUrl && onPick(edition.coverUrl)}
                className="block w-full text-left"
              >
                <Cover
                  book={{ title: edition.title, author: edition.author, color: "#2a2c33", coverUrl: edition.coverUrl }}
                  className={clsx("outline-2 outline-offset-2", edition.coverUrl === current ? "outline-accent" : "outline-transparent hover:outline-line")}
                />
                <span className="mt-1.5 block truncate text-xs text-faint">
                  {[edition.year, edition.publisher].filter(Boolean).join(", ") || "Google Books"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
