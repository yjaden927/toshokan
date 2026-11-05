import "dotenv/config";
import { execFileSync } from "node:child_process";

export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("Set TEST_DATABASE_URL in backend/.env to run the tests.");
  }
  // The tests wipe every table between cases, so refuse anything that isn't clearly a throwaway database.
  if (!new URL(url).pathname.endsWith("_test")) {
    throw new Error(`TEST_DATABASE_URL must point at a database whose name ends in "_test", got ${new URL(url).pathname}`);
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
