import { type AppOptions, createApp } from "../app.js";

// Tests that aren't about rate limiting make many requests from one address, so they get
// limits high enough never to trip. rate-limit.test.ts sets its own.
export function createTestApp(options: AppOptions) {
  return createApp({ secureCookies: true, rateLimits: { login: 1_000, signup: 1_000 }, ...options });
}
