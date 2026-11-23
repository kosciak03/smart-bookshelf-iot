/**
 * @packageDocumentation
 * Database helpers for integration tests.
 */
import { prisma } from "../lib/prisma.js";
import { assertTestDatabase } from "./test-database.js";

/**
 * Removes all rows from every application table of the test database.
 *
 * @throws When the configured database is not a test database.
 */
export async function resetDatabase(): Promise<void> {
  assertTestDatabase(process.env.DATABASE_URL);
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "ShelfEvent", "Book", "ShelfSlot" RESTART IDENTITY CASCADE');
}

export { prisma };
