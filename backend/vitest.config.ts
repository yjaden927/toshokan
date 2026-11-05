import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./src/testing/global-setup.ts"],
    // Integration tests share one database and reset it between tests, so files run one at a time.
    fileParallelism: false,
  },
});
