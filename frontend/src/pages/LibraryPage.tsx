import { useEffect, useState } from "react";
import { useAuth } from "../auth/context";
import { Button } from "../components/ui";
import { request } from "../lib/api";

export function LibraryPage() {
  const { user, logout } = useAuth();
  const [bookCount, setBookCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    request<{ books: unknown[] }>("/books")
      .then(({ books }) => setBookCount(books.length))
      .catch(() => setFailed(true));
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="flex items-center justify-between">
        <span className="font-serif text-2xl">Toshokan</span>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>{user?.displayName || user?.email}</span>
          <Button variant="secondary" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </header>
      <h1 className="mt-12 font-serif text-4xl">Your library</h1>
      <p className="mt-2 text-muted">
        {failed
          ? "Couldn't load your shelf. Refresh to try again."
          : bookCount === null
            ? "Loading your shelf…"
            : `${bookCount} ${bookCount === 1 ? "book" : "books"} on your shelf.`}
      </p>
    </main>
  );
}
