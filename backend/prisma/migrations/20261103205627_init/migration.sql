-- CreateEnum
CREATE TYPE "reading_status" AS ENUM ('want_to_read', 'reading', 'finished');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" VARCHAR(80) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "author" VARCHAR(200) NOT NULL,
    "year" INTEGER,
    "genre" VARCHAR(40) NOT NULL DEFAULT 'Other',
    "status" "reading_status" NOT NULL DEFAULT 'want_to_read',
    "rating" SMALLINT,
    "started_on" DATE,
    "finished_on" DATE,
    "synopsis" VARCHAR(3000) NOT NULL DEFAULT '',
    "notes" VARCHAR(3000) NOT NULL DEFAULT '',
    "color" VARCHAR(7) NOT NULL,
    "cover_url" VARCHAR(1000),
    "cover_picked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "books_user_id_status_idx" ON "books"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "books_user_id_title_author_key" ON "books"("user_id", "title", "author");

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "books"
  ADD CONSTRAINT "books_rating_range" CHECK ("rating" BETWEEN 1 AND 5),
  ADD CONSTRAINT "books_rating_only_when_finished" CHECK ("rating" IS NULL OR "status" = 'finished'),
  ADD CONSTRAINT "books_finished_on_requires_finished" CHECK ("finished_on" IS NULL OR "status" = 'finished'),
  ADD CONSTRAINT "books_dates_in_order" CHECK ("started_on" IS NULL OR "finished_on" IS NULL OR "started_on" <= "finished_on"),
  ADD CONSTRAINT "books_year_range" CHECK ("year" BETWEEN 1 AND 9999),
  ADD CONSTRAINT "books_color_hex" CHECK ("color" ~ '^#[0-9a-f]{6}$');
