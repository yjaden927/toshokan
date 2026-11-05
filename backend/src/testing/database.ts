import "dotenv/config";
import { createPrismaClient } from "../db.js";
import type { PrismaClient } from "../generated/prisma/client.js";

export function createTestPrisma() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Set TEST_DATABASE_URL in backend/.env to run the tests.");
  return createPrismaClient(url);
}

export async function resetDatabase(prisma: PrismaClient) {
  await prisma.$executeRaw`TRUNCATE TABLE "sessions", "books", "users" CASCADE`;
}
