/**
 * @packageDocumentation
 * Zod schemas (and inferred TypeScript types) for the `/api/books` endpoints.
 *
 * Shelf-related fields (`rfidUid`, `slotId`, `locationStatus`) are read-only
 * here: they are managed by the shelf/device module, so strict objects reject
 * them with HTTP 400.
 */
import { BookStatus } from "@prisma/client";
import { z } from "zod";
import { normalizeIsbn } from "../../lib/isbn.js";

/** ISBN input: hyphens/spaces allowed, ISBN-10 accepted; output is a normalized ISBN-13. */
export const isbnSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeIsbn(value);
  if (normalized === null) {
    ctx.addIssue({ code: "custom", message: "Invalid ISBN (expected a valid ISBN-13 or ISBN-10)" });
    return z.NEVER;
  }
  return normalized;
});

/** Date input: ISO date (`2026-11-23`) or ISO date-time with offset; output is a `Date`. */
const dateSchema = z
  .union([z.iso.datetime({ offset: true }), z.iso.date()])
  .transform((value) => new Date(value));

/** Tags: trimmed, lower-cased and de-duplicated. */
const tagsSchema = z
  .array(z.string().trim().min(1).max(50))
  .max(20)
  .transform((tags) => [...new Set(tags.map((tag) => tag.toLowerCase()))]);

/** Field definitions shared by the create and update schemas. */
const bookFields = {
  title: z.string().trim().min(1).max(500),
  author: z.string().trim().min(1).max(500),
  isbn: isbnSchema.nullable(),
  description: z.string().trim().max(10_000).nullable(),
  coverUrl: z.url({ protocol: /^https?$/ }).max(2048).nullable(),
  publisher: z.string().trim().min(1).max(200).nullable(),
  publishedYear: z.int().min(1450).max(2100).nullable(),
  tags: tagsSchema,
  pageCount: z.int().positive().max(100_000).nullable(),
  pagesRead: z.int().min(0),
  rating: z.int().min(1).max(5).nullable(),
  status: z.enum(BookStatus),
  startedAt: dateSchema.nullable(),
  finishedAt: dateSchema.nullable(),
} as const;

/** Values needed to check cross-field invariants of a book. */
export interface BookInvariantFields {
  pageCount?: number | null;
  pagesRead?: number;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}

/**
 * Checks rules spanning several fields (mirrors the database CHECK constraints).
 *
 * @param book - Field values to check (missing values are skipped).
 * @returns Issues as `[path, message]` pairs; empty when the data is consistent.
 */
export function bookInvariantIssues(book: BookInvariantFields): Array<[field: string, message: string]> {
  const issues: Array<[string, string]> = [];
  if (book.pageCount != null && book.pagesRead != null && book.pagesRead > book.pageCount) {
    issues.push(["pagesRead", `pagesRead (${book.pagesRead}) cannot exceed pageCount (${book.pageCount})`]);
  }
  if (book.startedAt != null && book.finishedAt != null && book.finishedAt < book.startedAt) {
    issues.push(["finishedAt", "finishedAt cannot be earlier than startedAt"]);
  }
  return issues;
}

/** Body of `POST /api/books`. Only `title` and `author` are required. */
export const createBookSchema = z
  .strictObject({
    title: bookFields.title,
    author: bookFields.author,
    isbn: bookFields.isbn.exactOptional(),
    description: bookFields.description.exactOptional(),
    coverUrl: bookFields.coverUrl.exactOptional(),
    publisher: bookFields.publisher.exactOptional(),
    publishedYear: bookFields.publishedYear.exactOptional(),
    tags: bookFields.tags.exactOptional(),
    pageCount: bookFields.pageCount.exactOptional(),
    pagesRead: bookFields.pagesRead.exactOptional(),
    rating: bookFields.rating.exactOptional(),
    status: bookFields.status.exactOptional(),
    startedAt: bookFields.startedAt.exactOptional(),
    finishedAt: bookFields.finishedAt.exactOptional(),
  })
  .superRefine((book, ctx) => {
    for (const [path, message] of bookInvariantIssues(book)) {
      ctx.addIssue({ code: "custom", path: [path], message });
    }
  });

/** Body of `PATCH /api/books/:id`. Every field is optional; `null` clears a nullable field. */
export const updateBookSchema = z
  .strictObject({
    title: bookFields.title.exactOptional(),
    author: bookFields.author.exactOptional(),
    isbn: bookFields.isbn.exactOptional(),
    description: bookFields.description.exactOptional(),
    coverUrl: bookFields.coverUrl.exactOptional(),
    publisher: bookFields.publisher.exactOptional(),
    publishedYear: bookFields.publishedYear.exactOptional(),
    tags: bookFields.tags.exactOptional(),
    pageCount: bookFields.pageCount.exactOptional(),
    pagesRead: bookFields.pagesRead.exactOptional(),
    rating: bookFields.rating.exactOptional(),
    status: bookFields.status.exactOptional(),
    startedAt: bookFields.startedAt.exactOptional(),
    finishedAt: bookFields.finishedAt.exactOptional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, { message: "At least one field must be provided" });

/** Fields the book list can be sorted by. */
export const BOOK_SORT_FIELDS = ["title", "author", "createdAt", "updatedAt", "rating", "publishedYear"] as const;

/** Query string of `GET /api/books`. */
export const listBooksQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(BOOK_SORT_FIELDS).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

/** Route parameters of `/api/books/:id`. */
export const bookIdParamsSchema = z.object({
  id: z.uuid({ message: "Book id must be a valid UUID" }),
});

/** Validated body of `POST /api/books`. */
export type CreateBookInput = z.output<typeof createBookSchema>;
/** Validated body of `PATCH /api/books/:id`. */
export type UpdateBookInput = z.output<typeof updateBookSchema>;
/** Validated query of `GET /api/books`. */
export type ListBooksQuery = z.output<typeof listBooksQuerySchema>;
/** Sortable field name. */
export type BookSortField = (typeof BOOK_SORT_FIELDS)[number];
