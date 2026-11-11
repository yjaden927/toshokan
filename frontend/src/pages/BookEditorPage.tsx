import clsx from "clsx";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { type BookForm, bindingFor, emptyForm, formFromBook, toBookInput } from "../books/form";
import { AppHeader } from "../components/AppHeader";
import { Cover } from "../components/Cover";
import { Button, Field, Input, Textarea } from "../components/ui";
import { ApiError, type Book, type Status, books } from "../lib/api";

const STATUSES: { value: Status; label: string }[] = [
  { value: "want_to_read", label: "Want to read" },
  { value: "reading", label: "Reading" },
  { value: "finished", label: "Finished" },
];

const MESSAGES: Record<string, string> = {
  duplicate_book: "This book is already on your shelf.",
  network_error: "Couldn't reach the server. Check your connection and try again.",
};

export function BookEditorPage() {
  const { id } = useParams();
  const isNew = id === undefined;
  const navigate = useNavigate();

  const [book, setBook] = useState<Book | null>(null);
  const [form, setForm] = useState<BookForm>(emptyForm);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (isNew) return;
    books
      .get(id)
      .then((found) => {
        setBook(found);
        setForm(formFromBook(found));
      })
      .catch((e: unknown) =>
        setLoadError(e instanceof ApiError && e.status === 404 ? "This book isn't on your shelf." : "Couldn't load this book."),
      );
  }, [id, isNew]);

  const set = <K extends keyof BookForm>(key: K, value: BookForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const showError = (e: unknown) => {
    if (e instanceof ApiError && e.code === "invalid_input" && Object.keys(e.fields).length > 0) setFieldErrors(e.fields);
    else if (e instanceof ApiError && e.detail.includes("finishedOn")) setError("The finish date can't be before the start date.");
    else setError((e instanceof ApiError && MESSAGES[e.code]) || "Something went wrong. Try again.");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setBusy(true);
    try {
      const input = toBookInput(form, book?.color ?? bindingFor(form.title));
      if (isNew) await books.create(input);
      else await books.update(id, input);
      navigate("/library");
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (isNew) return;
    setBusy(true);
    try {
      await books.remove(id);
      navigate("/library");
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-8">
        <AppHeader />
        <p className="mt-14 text-muted">{loadError}</p>
        <Link to="/library" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
          Back to your library
        </Link>
      </main>
    );
  }

  if (!isNew && !book) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-8">
        <AppHeader />
        <p className="mt-14 text-muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <AppHeader />
      <Link to="/library" className="mt-10 inline-block text-sm text-muted hover:text-ink">
        ← Library
      </Link>
      <h1 className="mt-3 font-serif text-4xl">{isNew ? "Add a book" : "Edit book"}</h1>

      <form onSubmit={save} noValidate className="mt-8 grid gap-10 md:grid-cols-[10rem_1fr]">
        <div>
          <Cover
            book={{
              title: form.title || "Untitled",
              author: form.author,
              color: book?.color ?? bindingFor(form.title),
              coverUrl: form.coverUrl,
            }}
            className="w-40"
          />
          {form.coverUrl && (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, coverUrl: null, coverPicked: false }))}
              className="mt-3 text-xs text-muted hover:text-ink"
            >
              Remove cover
            </button>
          )}
        </div>

        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Title" error={fieldErrors.title?.[0]}>
              {(fieldId, describedBy) => (
                <Input id={fieldId} aria-describedby={describedBy} value={form.title} onChange={(e) => set("title", e.target.value)} required />
              )}
            </Field>
            <Field label="Author" error={fieldErrors.author?.[0]}>
              {(fieldId, describedBy) => (
                <Input id={fieldId} aria-describedby={describedBy} value={form.author} onChange={(e) => set("author", e.target.value)} required />
              )}
            </Field>
            <Field label="Year" error={fieldErrors.year?.[0]}>
              {(fieldId, describedBy) => (
                <Input id={fieldId} aria-describedby={describedBy} inputMode="numeric" value={form.year} onChange={(e) => set("year", e.target.value)} />
              )}
            </Field>
            <Field label="Genre" error={fieldErrors.genre?.[0]}>
              {(fieldId, describedBy) => (
                <Input id={fieldId} aria-describedby={describedBy} value={form.genre} onChange={(e) => set("genre", e.target.value)} placeholder="Other" />
              )}
            </Field>
          </div>

          <fieldset>
            <legend className="text-sm font-medium">Status</legend>
            <div className="mt-1.5 inline-flex rounded-xl border border-line bg-field p-1">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={form.status === s.value}
                  onClick={() => set("status", s.value)}
                  className={clsx(
                    "rounded-lg px-3 py-1.5 text-sm transition-colors duration-150",
                    form.status === s.value ? "bg-surface font-medium text-ink shadow-sm" : "text-muted hover:text-ink",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>

          {form.status !== "want_to_read" && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Started" error={fieldErrors.startedOn?.[0]}>
                {(fieldId, describedBy) => (
                  <Input id={fieldId} aria-describedby={describedBy} type="date" value={form.startedOn} onChange={(e) => set("startedOn", e.target.value)} />
                )}
              </Field>
              {form.status === "finished" && (
                <Field label="Finished" error={fieldErrors.finishedOn?.[0]}>
                  {(fieldId, describedBy) => (
                    <Input id={fieldId} aria-describedby={describedBy} type="date" value={form.finishedOn} onChange={(e) => set("finishedOn", e.target.value)} />
                  )}
                </Field>
              )}
            </div>
          )}

          {form.status === "finished" && (
            <fieldset>
              <legend className="text-sm font-medium">Rating</legend>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    aria-pressed={form.rating === n}
                    onClick={() => set("rating", form.rating === n ? null : n)}
                    className={clsx("text-2xl leading-none", form.rating !== null && n <= form.rating ? "text-accent" : "text-faint")}
                  >
                    ★
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <Field label="Tags" error={fieldErrors.tags?.[0]} hint="Separate with commas, like: sci-fi, book club">
            {(fieldId, describedBy) => (
              <Input id={fieldId} aria-describedby={describedBy} value={form.tags} onChange={(e) => set("tags", e.target.value)} />
            )}
          </Field>

          <Field label="Notes" error={fieldErrors.notes?.[0]}>
            {(fieldId, describedBy) => (
              <Textarea id={fieldId} aria-describedby={describedBy} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            )}
          </Field>

          {error && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <Button type="submit" disabled={busy}>
              {isNew ? "Add to library" : "Save changes"}
            </Button>
            <Link to="/library" className="text-sm text-muted hover:text-ink">
              Cancel
            </Link>
            {!isNew && (
              <div className="ml-auto flex items-center gap-2">
                {confirmingDelete ? (
                  <>
                    <span className="text-sm text-muted">Delete this book?</span>
                    <Button variant="danger" disabled={busy} onClick={() => void remove()}>
                      Delete
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                      Keep it
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
                    Delete book
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </form>
    </main>
  );
}
