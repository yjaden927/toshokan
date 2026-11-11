export interface User {
  id: string;
  email: string;
  displayName: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string[] | undefined>;
  /** The server's explanation, when it sends one. */
  readonly detail: string;

  constructor(status: number, code: string, fields: Record<string, string[] | undefined> = {}, detail = "") {
    super(`${status} ${code}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.detail = detail;
  }
}

export async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "network_error");
  }

  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const body = (data ?? {}) as { error?: string; fields?: Record<string, string[]>; message?: string };
    throw new ApiError(res.status, body.error ?? "unknown_error", body.fields, body.message);
  }
  return data as T;
}

export const auth = {
  me: () => request<{ user: User }>("/auth/me").then((r) => r.user),
  login: (email: string, password: string) =>
    request<{ user: User }>("/auth/login", { method: "POST", body: { email, password } }).then((r) => r.user),
  signup: (input: { email: string; password: string; displayName: string }) =>
    request<{ user: User }>("/auth/signup", { method: "POST", body: input }).then((r) => r.user),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
};

export type Status = "want_to_read" | "reading" | "finished";

export interface Book {
  id: string;
  title: string;
  author: string;
  year: number | null;
  genre: string;
  status: Status;
  rating: number | null;
  startedOn: string | null;
  finishedOn: string | null;
  synopsis: string;
  notes: string;
  color: string;
  coverUrl: string | null;
  coverPicked: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** What the client sends to create or update a book. The synopsis isn't edited in the app yet. */
export type BookInput = Omit<Book, "id" | "createdAt" | "updatedAt" | "synopsis">;

export interface TagCount {
  name: string;
  bookCount: number;
}

export const books = {
  list: (filters: { status?: Status | undefined; q?: string | undefined; tag?: string | undefined } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    const query = params.size ? `?${params}` : "";
    return request<{ books: Book[] }>(`/books${query}`).then((r) => r.books);
  },
  get: (id: string) => request<{ book: Book }>(`/books/${encodeURIComponent(id)}`).then((r) => r.book),
  create: (input: BookInput) => request<{ book: Book }>("/books", { method: "POST", body: input }).then((r) => r.book),
  update: (id: string, changes: Partial<BookInput>) =>
    request<{ book: Book }>(`/books/${encodeURIComponent(id)}`, { method: "PATCH", body: changes }).then((r) => r.book),
  remove: (id: string) => request<void>(`/books/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export const tags = {
  list: () => request<{ tags: TagCount[] }>("/tags").then((r) => r.tags),
};
