export interface User {
  id: string;
  email: string;
  displayName: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string[] | undefined>;

  constructor(status: number, code: string, fields: Record<string, string[] | undefined> = {}) {
    super(`${status} ${code}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
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
    const body = (data ?? {}) as { error?: string; fields?: Record<string, string[]> };
    throw new ApiError(res.status, body.error ?? "unknown_error", body.fields);
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
