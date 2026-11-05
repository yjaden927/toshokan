import "dotenv/config";
import { createApp } from "./app.js";
import { createPrismaClient } from "./db.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Copy backend/.env.example to backend/.env.");
}

const port = Number(process.env.PORT ?? 3000);
const prisma = createPrismaClient(databaseUrl);

createApp({ prisma, secureCookies: process.env.NODE_ENV === "production" }).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
