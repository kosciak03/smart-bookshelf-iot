-- Reading-state invariants (mirror src/modules/books/book-rules.ts), so that
-- inconsistent data is rejected even when written outside the API
-- (Prisma Studio, psql). Prisma cannot express CHECK constraints, so the
-- schema file is unchanged.

-- Repair rows written before these rules existed, so the constraints can be added.
-- A "want to read" book with progress is in fact being read.
UPDATE "Book" SET "status" = 'READING' WHERE "status" = 'WANT_TO_READ' AND "pagesRead" > 0;
UPDATE "Book" SET "startedAt" = NULL, "finishedAt" = NULL, "rating" = NULL
  WHERE "status" = 'WANT_TO_READ' AND ("startedAt" IS NOT NULL OR "finishedAt" IS NOT NULL OR "rating" IS NOT NULL);
UPDATE "Book" SET "finishedAt" = NULL WHERE "status" = 'READING' AND "finishedAt" IS NOT NULL;
UPDATE "Book" SET "pagesRead" = "pageCount"
  WHERE "status" = 'READ' AND "pageCount" IS NOT NULL AND "pagesRead" <> "pageCount";

-- WANT_TO_READ: no progress, no reading dates, no rating.
ALTER TABLE "Book" ADD CONSTRAINT "Book_want_to_read_state_check" CHECK (
  "status" <> 'WANT_TO_READ'
  OR ("pagesRead" = 0 AND "startedAt" IS NULL AND "finishedAt" IS NULL AND "rating" IS NULL)
);

-- READING: not finished yet.
ALTER TABLE "Book" ADD CONSTRAINT "Book_reading_state_check" CHECK (
  "status" <> 'READING' OR "finishedAt" IS NULL
);

-- READ: every page read (when the page count is known).
ALTER TABLE "Book" ADD CONSTRAINT "Book_read_state_check" CHECK (
  "status" <> 'READ' OR "pageCount" IS NULL OR "pagesRead" = "pageCount"
);
