/**
 * @packageDocumentation
 * Data access and business rules for books.
 */
import type { Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "../../lib/http-errors.js";
import { prisma } from "../../lib/prisma.js";
import {
  bookInvariantIssues,
  type BookSortField,
  type CreateBookInput,
  type ListBooksQuery,
  type UpdateBookInput,
} from "./book.schemas.js";

/** Relations included in every book returned by the API. */
export const bookInclude = {
  slot: { select: { id: true, shelfNumber: true, slotNumber: true } },
} satisfies Prisma.BookInclude;

/** Book as returned by the API (with a summary of its shelf slot). */
export type BookDto = Prisma.BookGetPayload<{ include: typeof bookInclude }>;

/** Pagination metadata of a collection response. */
export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** A page of books together with pagination metadata. */
export interface BookPage {
  data: BookDto[];
  meta: PageMeta;
}

/** Sort fields that are nullable and should keep `null` values at the end. */
const NULLABLE_SORT_FIELDS: ReadonlySet<BookSortField> = new Set(["rating", "publishedYear"]);

/**
 * Builds the Prisma `orderBy` clause, with `id` as a tie-breaker so that
 * pagination is stable.
 *
 * @param sort - Field to sort by.
 * @param order - Sort direction.
 * @returns Prisma order-by list.
 */
function buildOrderBy(sort: BookSortField, order: Prisma.SortOrder): Prisma.BookOrderByWithRelationInput[] {
  const primary: Prisma.BookOrderByWithRelationInput = NULLABLE_SORT_FIELDS.has(sort)
    ? { [sort]: { sort: order, nulls: "last" } }
    : { [sort]: order };
  return [primary, { id: "asc" }];
}

/**
 * Returns one page of books.
 *
 * @param query - Validated pagination and sorting options.
 * @returns Books of the requested page and pagination metadata.
 */
export async function listBooks(query: ListBooksQuery): Promise<BookPage> {
  const { page, pageSize, sort, order } = query;
  const [data, total] = await prisma.$transaction([
    prisma.book.findMany({
      include: bookInclude,
      orderBy: buildOrderBy(sort, order),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.book.count(),
  ]);
  return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

/**
 * Finds a book by id.
 *
 * @param id - Book UUID.
 * @returns The book.
 * @throws {@link NotFoundError} when no book has this id.
 */
export async function getBook(id: string): Promise<BookDto> {
  const book = await prisma.book.findUnique({ where: { id }, include: bookInclude });
  if (book === null) throw new NotFoundError("Book", id);
  return book;
}

/**
 * Creates a book. A duplicate ISBN is reported by the database (P2002) and
 * mapped to HTTP 409 by the error handler.
 *
 * @param input - Validated book data.
 * @returns The created book.
 */
export async function createBook(input: CreateBookInput): Promise<BookDto> {
  return prisma.book.create({ data: input, include: bookInclude });
}

/**
 * Partially updates a book. Cross-field rules are checked against the merged
 * state (stored values + patch), e.g. lowering `pageCount` below `pagesRead`.
 *
 * @param id - Book UUID.
 * @param patch - Validated fields to change.
 * @returns The updated book.
 * @throws {@link NotFoundError} when no book has this id.
 * @throws {@link ValidationError} when the merged state is inconsistent.
 */
export async function updateBook(id: string, patch: UpdateBookInput): Promise<BookDto> {
  const current = await getBook(id);
  const issues = bookInvariantIssues({ ...current, ...patch });
  if (issues.length > 0) {
    throw new ValidationError(
      "Update would leave the book in an inconsistent state",
      issues.map(([field, message]) => ({ path: `body.${field}`, message })),
    );
  }
  return prisma.book.update({ where: { id }, data: patch, include: bookInclude });
}

/**
 * Deletes a book. Its shelf slot becomes free and its shelf events are kept
 * (their `bookId` is set to `null` by the database).
 *
 * @param id - Book UUID.
 * @throws {@link NotFoundError} when no book has this id.
 */
export async function deleteBook(id: string): Promise<void> {
  const { count } = await prisma.book.deleteMany({ where: { id } });
  if (count === 0) throw new NotFoundError("Book", id);
}
