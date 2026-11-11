import type { Book, BookInput, Status } from "../lib/api";

export interface BookForm {
  title: string;
  author: string;
  year: string;
  genre: string;
  status: Status;
  rating: number | null;
  startedOn: string;
  finishedOn: string;
  tags: string;
  notes: string;
  coverUrl: string | null;
  coverPicked: boolean;
}

export const emptyForm: BookForm = {
  title: "",
  author: "",
  year: "",
  genre: "",
  status: "want_to_read",
  rating: null,
  startedOn: "",
  finishedOn: "",
  tags: "",
  notes: "",
  coverUrl: null,
  coverPicked: false,
};

export function formFromBook(book: Book): BookForm {
  return {
    title: book.title,
    author: book.author,
    year: book.year?.toString() ?? "",
    genre: book.genre === "Other" ? "" : book.genre,
    status: book.status,
    rating: book.rating,
    startedOn: book.startedOn ?? "",
    finishedOn: book.finishedOn ?? "",
    tags: book.tags.join(", "),
    notes: book.notes,
    coverUrl: book.coverUrl,
    coverPicked: book.coverPicked,
  };
}

// Binding colors for typeset covers, all dark or light enough to hold their text.
const BINDINGS = ["#24485e", "#36586b", "#8a5a2b", "#6b3a5e", "#2f5e4a", "#9a4a2c", "#5b4a8a", "#7a2e2e", "#2a2c33", "#a04a2a", "#1f3a5f", "#d9c9a3"];

/** The same title always gets the same binding, so a book doesn't change color between visits. */
export function bindingFor(title: string) {
  let hash = 0;
  for (const char of title.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return BINDINGS[hash % BINDINGS.length]!;
}

/** The form's strings turned into what the API expects. The API does the real validation. */
export function toBookInput(form: BookForm, color: string): BookInput {
  const year = form.year.trim() ? Number(form.year) : null;
  return {
    title: form.title.trim(),
    author: form.author.trim(),
    year: year !== null && Number.isFinite(year) ? year : null,
    genre: form.genre.trim() || "Other",
    status: form.status,
    rating: form.status === "finished" ? form.rating : null,
    startedOn: form.status !== "want_to_read" && form.startedOn ? form.startedOn : null,
    finishedOn: form.status === "finished" && form.finishedOn ? form.finishedOn : null,
    tags: form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    notes: form.notes.trim(),
    color,
    coverUrl: form.coverUrl,
    coverPicked: form.coverPicked,
  };
}
