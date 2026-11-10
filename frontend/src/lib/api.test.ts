import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, auth, request } from "./api";

function respond(status: number, body?: unknown) {
  const fetch = vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe("request", () => {
  it("sends JSON to the API under /api with the session cookie", async () => {
    const fetch = respond(200, { user: { id: "1", email: "a@example.com", displayName: "" } });

    await auth.login("a@example.com", "secret password");

    expect(fetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@example.com", password: "secret password" }),
    });
  });

  it("turns an error response into an ApiError with the server's code and field errors", async () => {
    respond(400, { error: "invalid_input", fields: { email: ["Invalid email address"] } });

    const error = await request("/auth/signup", { method: "POST", body: {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: "invalid_input", fields: { email: ["Invalid email address"] } });
  });

  it("copes with an error response that isn't JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Bad Gateway", { status: 502 })));

    await expect(request("/books")).rejects.toMatchObject({ status: 502, code: "unknown_error" });
  });

  it("reports a network failure as status 0", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));

    await expect(request("/books")).rejects.toMatchObject({ status: 0, code: "network_error" });
  });

  it("resolves a 204 without trying to parse a body", async () => {
    respond(204);

    await expect(auth.logout()).resolves.toBeUndefined();
  });
});
