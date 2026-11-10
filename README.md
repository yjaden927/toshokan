# Toshokan

Toshokan (図書館) is Japanese for "library". It's a personal reading tracker: log the books you
read, track what you're reading now, rate what you finish and tag everything.

A solo rebuild of my FIU capstone project, MyLittleLibrary, engineered as a production-style
TypeScript monorepo with a custom backend.

**Status:** the backend API is complete and tested. The React frontend is in progress.

## Stack

| Layer | Choice |
|---|---|
| API | Node.js, Express 5, TypeScript (strict) |
| Database | PostgreSQL 18, Prisma 7 with versioned migrations |
| Validation | zod |
| Tests | Vitest and Supertest against a real Postgres test database |
| CI | GitHub Actions: typecheck, tests, builds and dependency audit on every PR |
| Frontend | React 19, Vite, Tailwind (in progress) |

## What the API does

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Checks the database; 503 when it's unreachable |
| POST | `/auth/signup` | Creates an account and starts a session |
| POST | `/auth/login` | Rate-limited: 10 attempts per 15 minutes per IP |
| POST | `/auth/logout` | Deletes the session server-side |
| GET | `/auth/me` | The signed-in reader |
| GET | `/books` | Filters: `status`, `q` (title or author), `tag` |
| POST | `/books` | Add a book |
| GET, PATCH, DELETE | `/books/:id` | Only ever the signed-in reader's own books |
| GET | `/tags` | Tags in use, with book counts |

## Security

- Passwords hashed with scrypt (random salt per password, constant-time comparison)
- Server-side sessions: the cookie holds a random token, the database only its SHA-256 hash
- Session cookie is `HttpOnly`, `SameSite=Lax` and `Secure` in production
- Every book query is scoped to the signed-in user; other readers' books return 404
- Login answers identically for wrong passwords and unknown emails, including response time
- All input validated with zod; unknown fields rejected; cover images limited to HTTPS from Google Books or Open Library
- CHECK constraints in the database back up the API's validation
- Parameterized queries throughout (Prisma); no SQL built from strings

## Run it locally

Requires Node 22+ and Docker.

```bash
cp .env.example .env
cp backend/.env.example backend/.env
# Use the same password in both files: POSTGRES_PASSWORD in .env and in the URLs in backend/.env

docker compose up -d
docker compose exec db createdb -U toshokan toshokan_test

npm install
npm run db:migrate -w backend
npm run db:generate -w backend
npm run db:seed -w backend

npm run dev -w backend
```

The API runs on http://localhost:3000. The seed creates `demo@toshokan.dev` with the password set
as `SEED_DEMO_PASSWORD` in `backend/.env`.

## Tests

```bash
npm run test -w backend
```

The tests run against `TEST_DATABASE_URL`, which must name a database ending in `_test`. The
setup refuses anything else, because the tests wipe every table between cases.

## Project history

Built in small commits on feature branches, each merged through a pull request. The PR list is
the best way to see how it came together.
