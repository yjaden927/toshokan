import "dotenv/config";
import { hashPassword } from "./auth/password.js";
import { createPrismaClient } from "./db.js";
import type { Prisma } from "./generated/prisma/client.js";

const DEMO_EMAIL = "demo@toshokan.dev";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

const books: Omit<Prisma.BookCreateManyInput, "userId">[] = [
  { title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", year: 1969, genre: "Science Fiction", status: "FINISHED", rating: 5, startedOn: day("2026-01-04"), finishedOn: day("2026-01-19"), color: "#24485e", notes: "The ice crossing chapters." },
  { title: "Kitchen", author: "Banana Yoshimoto", year: 1988, genre: "Literary Fiction", status: "FINISHED", rating: 4, startedOn: day("2026-02-01"), finishedOn: day("2026-02-02"), color: "#36586b", notes: "Read it in one sitting on a flight." },
  { title: "The Dispossessed", author: "Ursula K. Le Guin", year: 1974, genre: "Science Fiction", status: "FINISHED", rating: 5, startedOn: day("2026-02-10"), finishedOn: day("2026-03-05"), color: "#8a5a2b" },
  { title: "Convenience Store Woman", author: "Sayaka Murata", year: 2016, genre: "Literary Fiction", status: "FINISHED", rating: 4, startedOn: day("2026-03-08"), finishedOn: day("2026-03-12"), color: "#6b3a5e" },
  { title: "The Name of the Rose", author: "Umberto Eco", year: 1980, genre: "Mystery", status: "FINISHED", rating: 3, startedOn: day("2026-03-20"), finishedOn: day("2026-05-02"), color: "#2f5e4a" },
  { title: "Pachinko", author: "Min Jin Lee", year: 2017, genre: "Historical Fiction", status: "FINISHED", rating: 5, startedOn: day("2026-05-10"), finishedOn: day("2026-06-14"), color: "#9a4a2c" },
  { title: "Station Eleven", author: "Emily St. John Mandel", year: 2014, genre: "Science Fiction", status: "FINISHED", rating: 4, startedOn: day("2026-06-20"), finishedOn: day("2026-07-01"), color: "#5b4a8a" },
  { title: "Crafting Interpreters", author: "Robert Nystrom", year: 2021, genre: "Technology", status: "READING", startedOn: day("2026-10-19"), color: "#7a2e2e", notes: "Up to the bytecode VM." },
  { title: "Middlemarch", author: "George Eliot", year: 1871, genre: "Literary Fiction", status: "READING", startedOn: day("2026-10-05"), color: "#2a2c33" },
  { title: "Hyperion", author: "Dan Simmons", year: 1989, genre: "Science Fiction", status: "READING", startedOn: day("2026-10-24"), color: "#a04a2a" },
  { title: "Gilead", author: "Marilynne Robinson", year: 2004, genre: "Literary Fiction", status: "WANT_TO_READ", color: "#1f3a5f" },
  { title: "Rebecca", author: "Daphne du Maurier", year: 1938, genre: "Mystery", status: "WANT_TO_READ", color: "#6b2a2a" },
];

const databaseUrl = process.env.DATABASE_URL;
const demoPassword = process.env.SEED_DEMO_PASSWORD;
if (!databaseUrl || !demoPassword) {
  throw new Error("Set DATABASE_URL and SEED_DEMO_PASSWORD in backend/.env before seeding.");
}

const prisma = createPrismaClient(databaseUrl);

try {
  const passwordHash = await hashPassword(demoPassword);

  // Resetting the demo account inside one transaction keeps the seed repeatable:
  // running it twice leaves the same data, and a failure halfway leaves nothing half-written.
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email: DEMO_EMAIL },
      update: { passwordHash, displayName: "Demo Reader" },
      create: { email: DEMO_EMAIL, passwordHash, displayName: "Demo Reader" },
    });
    await tx.book.deleteMany({ where: { userId: user.id } });
    await tx.book.createMany({ data: books.map((book) => ({ ...book, userId: user.id })) });
  });

  console.log(`Seeded ${books.length} books for ${DEMO_EMAIL}`);
} finally {
  await prisma.$disconnect();
}
