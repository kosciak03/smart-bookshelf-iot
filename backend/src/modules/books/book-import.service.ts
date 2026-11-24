/**
 * @packageDocumentation
 * Creates a book from external ISBN metadata (`POST /api/books/import`).
 *
 * Flow:
 * 1. Reject a duplicate ISBN early (409), before calling external APIs.
 * 2. Check the optional shelf slot (400 if missing, 409 if occupied).
 * 3. Fetch metadata (404 / 502 propagated from the lookup service).
 * 4. Merge fetched data with the client's overrides and validate the result
 *    with the regular create schema.
 * 5. Save the book.
 */
import { ConflictError, ValidationError } from "../../lib/http-errors.js";
import { prisma } from "../../lib/prisma.js";
import { parseRequest } from "../../lib/validate.js";
import type { MetadataSource } from "../isbn/metadata.types.js";
import { isbnLookupService } from "../isbn/isbn.service.js";
import { createBookSchema, type ImportBookInput } from "./book.schemas.js";
import { bookInclude, type BookDto } from "./book.service.js";

/** Result of an import. */
export interface ImportBookResult {
  book: BookDto;
  /** Source the metadata came from. */
  source: MetadataSource;
  /** Whether the metadata was served from the cache. */
  cached: boolean;
}

/**
 * Ensures the slot exists and is free.
 *
 * @param slotId - Slot UUID.
 * @throws {@link ValidationError} (400) when the slot does not exist.
 * @throws {@link ConflictError} (409) when another book occupies the slot.
 */
async function assertSlotAvailable(slotId: string): Promise<void> {
  const slot = await prisma.shelfSlot.findUnique({ where: { id: slotId }, include: { book: { select: { id: true } } } });
  if (slot === null) {
    throw new ValidationError("Invalid request body", [{ path: "body.slotId", message: `Shelf slot '${slotId}' does not exist` }]);
  }
  if (slot.book !== null) {
    throw new ConflictError("SLOT_CONFLICT", `Shelf slot ${slot.slotNumber} is already assigned to another book`);
  }
}

/**
 * Imports a book by ISBN.
 *
 * @param input - Validated request body.
 * @param rawBody - Original request body; overrides are taken from it unparsed
 *   so the merged book can be validated by {@link createBookSchema} as a whole.
 * @returns The created book and the metadata source.
 */
export async function importBook(input: ImportBookInput, rawBody: Record<string, unknown>): Promise<ImportBookResult> {
  const { isbn, slotId = null } = input;

  const existing = await prisma.book.findUnique({ where: { isbn }, select: { id: true } });
  if (existing !== null) {
    throw new ConflictError("ISBN_CONFLICT", `A book with ISBN ${isbn} already exists (id: ${existing.id})`);
  }
  if (slotId !== null) await assertSlotAvailable(slotId);

  const { metadata, cached } = await isbnLookupService.lookup(isbn);
  if (metadata.author === null && input.author === undefined) {
    throw new ValidationError("Invalid request body", [
      { path: "body.author", message: "The metadata source has no author for this ISBN; provide 'author' in the request" },
    ]);
  }

  const { isbn: _isbn, slotId: _slotId, ...overrides } = rawBody;
  const fetched = {
    title: metadata.title,
    ...(metadata.author !== null ? { author: metadata.author } : {}),
    description: metadata.description,
    coverUrl: metadata.coverUrl,
    publisher: metadata.publisher,
    publishedYear: metadata.publishedYear,
    pageCount: metadata.pageCount,
    tags: metadata.tags,
  };
  const data = parseRequest(createBookSchema, { ...fetched, ...overrides, isbn }, "body");

  const book = await prisma.book.create({
    data: { ...data, slotId, locationStatus: slotId === null ? "UNASSIGNED" : "OFF_SHELF" },
    include: bookInclude,
  });
  return { book, source: metadata.source, cached };
}
