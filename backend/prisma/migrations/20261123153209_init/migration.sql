-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('WANT_TO_READ', 'READING', 'READ');

-- CreateEnum
CREATE TYPE "LocationStatus" AS ENUM ('UNASSIGNED', 'ON_SHELF', 'OFF_SHELF');

-- CreateEnum
CREATE TYPE "ShelfEventType" AS ENUM ('BOOK_PLACED', 'BOOK_REMOVED', 'RFID_SCANNED', 'MISPLACED', 'HIGHLIGHT_ON', 'HIGHLIGHT_OFF');

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "isbn" VARCHAR(13),
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "publisher" TEXT,
    "publishedYear" SMALLINT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pageCount" INTEGER,
    "pagesRead" INTEGER NOT NULL DEFAULT 0,
    "rating" SMALLINT,
    "status" "BookStatus" NOT NULL DEFAULT 'WANT_TO_READ',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "locationStatus" "LocationStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "rfidUid" VARCHAR(20),
    "slotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShelfSlot" (
    "id" TEXT NOT NULL,
    "shelfNumber" SMALLINT NOT NULL DEFAULT 1,
    "slotNumber" SMALLINT NOT NULL,
    "ledStartIdx" SMALLINT NOT NULL,
    "ledEndIdx" SMALLINT NOT NULL,
    "fsrChannel" SMALLINT NOT NULL,
    "isOccupied" BOOLEAN NOT NULL DEFAULT false,
    "isHighlighted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShelfSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShelfEvent" (
    "id" TEXT NOT NULL,
    "type" "ShelfEventType" NOT NULL,
    "bookId" TEXT,
    "slotId" TEXT,
    "rfidUid" VARCHAR(20),
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShelfEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Book_isbn_key" ON "Book"("isbn");

-- CreateIndex
CREATE UNIQUE INDEX "Book_rfidUid_key" ON "Book"("rfidUid");

-- CreateIndex
CREATE UNIQUE INDEX "Book_slotId_key" ON "Book"("slotId");

-- CreateIndex
CREATE INDEX "Book_status_idx" ON "Book"("status");

-- CreateIndex
CREATE INDEX "Book_locationStatus_idx" ON "Book"("locationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ShelfSlot_shelfNumber_slotNumber_key" ON "ShelfSlot"("shelfNumber", "slotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ShelfSlot_shelfNumber_fsrChannel_key" ON "ShelfSlot"("shelfNumber", "fsrChannel");

-- CreateIndex
CREATE INDEX "ShelfEvent_createdAt_idx" ON "ShelfEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ShelfEvent_bookId_idx" ON "ShelfEvent"("bookId");

-- CreateIndex
CREATE INDEX "ShelfEvent_slotId_idx" ON "ShelfEvent"("slotId");

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ShelfSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfEvent" ADD CONSTRAINT "ShelfEvent_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfEvent" ADD CONSTRAINT "ShelfEvent_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ShelfSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Manually added integrity rules (Prisma schema cannot express CHECK constraints).
-- They mirror the zod validation in the API, so invalid data is rejected even
-- when written outside the application (e.g. Prisma Studio, psql).
-- ---------------------------------------------------------------------------

-- Book
ALTER TABLE "Book" ADD CONSTRAINT "Book_isbn_format_check" CHECK ("isbn" ~ '^[0-9]{13}$');
ALTER TABLE "Book" ADD CONSTRAINT "Book_rfidUid_format_check" CHECK ("rfidUid" ~ '^[0-9A-F]{8,20}$');
ALTER TABLE "Book" ADD CONSTRAINT "Book_rating_range_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "Book" ADD CONSTRAINT "Book_pageCount_positive_check" CHECK ("pageCount" > 0);
ALTER TABLE "Book" ADD CONSTRAINT "Book_pagesRead_range_check" CHECK ("pagesRead" >= 0 AND ("pageCount" IS NULL OR "pagesRead" <= "pageCount"));
ALTER TABLE "Book" ADD CONSTRAINT "Book_publishedYear_range_check" CHECK ("publishedYear" BETWEEN 1450 AND 2100);
ALTER TABLE "Book" ADD CONSTRAINT "Book_reading_dates_check" CHECK ("startedAt" IS NULL OR "finishedAt" IS NULL OR "finishedAt" >= "startedAt");

-- ShelfSlot
ALTER TABLE "ShelfSlot" ADD CONSTRAINT "ShelfSlot_shelfNumber_positive_check" CHECK ("shelfNumber" >= 1);
ALTER TABLE "ShelfSlot" ADD CONSTRAINT "ShelfSlot_slotNumber_positive_check" CHECK ("slotNumber" >= 1);
ALTER TABLE "ShelfSlot" ADD CONSTRAINT "ShelfSlot_fsrChannel_range_check" CHECK ("fsrChannel" BETWEEN 0 AND 4);
ALTER TABLE "ShelfSlot" ADD CONSTRAINT "ShelfSlot_led_range_check" CHECK ("ledStartIdx" >= 0 AND "ledEndIdx" >= "ledStartIdx");
