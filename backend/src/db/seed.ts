/**
 * @packageDocumentation
 * Idempotent database seed (`npm run db:seed` / `prisma db seed`).
 *
 * Running it repeatedly yields the same state without duplicates:
 * - slots are upserted by `(shelfNumber, slotNumber)`,
 * - books are upserted by `isbn` and reset to their sample values,
 * - any other book occupying a sample slot or RFID UID is detached first,
 *   so unique constraints never fail.
 *
 * Shelf events are append-only and are intentionally not seeded.
 */
import type { Prisma } from "@prisma/client";
import { isValidIsbn13 } from "../lib/isbn.js";
import { prisma } from "../lib/prisma.js";
import { SEED_BOOKS, SEED_SLOTS, openLibraryCoverUrl } from "./seed-data.js";

/** Shelf number of the single prototype shelf. */
const SHELF_NUMBER = 1;

/**
 * Upserts the shelf slots.
 *
 * @param tx - Transaction client.
 * @param occupiedSlots - Slot numbers whose FSR should report an item.
 * @returns Map from slot number to slot id.
 */
async function seedSlots(tx: Prisma.TransactionClient, occupiedSlots: ReadonlySet<number>): Promise<Map<number, string>> {
  const slotIds = new Map<number, string>();
  for (const slot of SEED_SLOTS) {
    const data = {
      ledStartIdx: slot.ledStartIdx,
      ledEndIdx: slot.ledEndIdx,
      fsrChannel: slot.fsrChannel,
      isOccupied: occupiedSlots.has(slot.slotNumber),
      isHighlighted: false,
    };
    const saved = await tx.shelfSlot.upsert({
      where: { shelfNumber_slotNumber: { shelfNumber: SHELF_NUMBER, slotNumber: slot.slotNumber } },
      create: { shelfNumber: SHELF_NUMBER, slotNumber: slot.slotNumber, ...data },
      update: data,
    });
    slotIds.set(slot.slotNumber, saved.id);
  }
  return slotIds;
}

/**
 * Upserts the sample books and links them to their slots.
 *
 * @param tx - Transaction client.
 * @param slotIds - Map from slot number to slot id.
 */
async function seedBooks(tx: Prisma.TransactionClient, slotIds: ReadonlyMap<number, string>): Promise<void> {
  for (const { slotNumber, ...book } of SEED_BOOKS) {
    const slotId = slotNumber === null ? null : (slotIds.get(slotNumber) ?? null);

    // Detach other books holding this book's slot or RFID tag.
    if (slotId !== null) {
      await tx.book.updateMany({
        where: { slotId, NOT: { isbn: book.isbn } },
        data: { slotId: null, locationStatus: "UNASSIGNED" },
      });
    }
    if (book.rfidUid !== null) {
      await tx.book.updateMany({
        where: { rfidUid: book.rfidUid, NOT: { isbn: book.isbn } },
        data: { rfidUid: null },
      });
    }

    const data = { ...book, coverUrl: openLibraryCoverUrl(book.isbn), slotId };
    await tx.book.upsert({ where: { isbn: book.isbn }, create: data, update: data });
  }
}

/**
 * Validates the sample data and writes it in a single transaction.
 */
async function main(): Promise<void> {
  const invalid = SEED_BOOKS.filter((book) => !isValidIsbn13(book.isbn));
  if (invalid.length > 0) {
    throw new Error(`Invalid ISBN-13 in seed data: ${invalid.map((book) => book.isbn).join(", ")}`);
  }

  const occupiedSlots = new Set(
    SEED_BOOKS.filter((book) => book.locationStatus === "ON_SHELF" && book.slotNumber !== null).map(
      (book) => book.slotNumber as number,
    ),
  );

  await prisma.$transaction(async (tx) => {
    const slotIds = await seedSlots(tx, occupiedSlots);
    await seedBooks(tx, slotIds);
  });

  const [slots, books] = await Promise.all([prisma.shelfSlot.count(), prisma.book.count()]);
  console.log(`[seed] Done: ${slots} shelf slots, ${books} books in the database.`);
}

main()
  .catch((error: unknown) => {
    console.error("[seed] Failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
