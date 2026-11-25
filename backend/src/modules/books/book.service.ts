/**
 * @packageDocumentation
 * Data access and business rules for books.
 */
import type { Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "../../lib/http-errors.js";
import { prisma } from "../../lib/prisma.js";
import { searchBooks } from "./book-search.js";
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

/** Column sort fields (everything except the computed `relevance`). */
type ColumnSortField = Exclude<BookSortField, "relevance">;

/**
 * Builds the Prisma `orderBy` clause, with `id` as a tie-breaker so that
 * pagination is stable.
 *
 * @param sort - Field to sort by.
 * @param order - Sort direction.
 * @returns Prisma order-by list.
 */
function buildOrderBy(sort: ColumnSortField, order: Prisma.SortOrder): Prisma.BookOrderByWithRelationInput[] {
  const primary: Prisma.BookOrderByWithRelationInput = NULLABLE_SORT_FIELDS.has(sort)
    ? { [sort]: { sort: order, nulls: "last" } }
    : { [sort]: order };
  return [primary, { id: "asc" }];
}

/**
 * Builds the Prisma filter from the structured query parameters (everything
 * except the `q` text search).
 *
 * @param query - Validated list query.
 * @returns Prisma `where` clause.
 */
export function buildBookFilter(query: ListBooksQuery): Prisma.BookWhereInput {
  const conditions: Prisma.BookWhereInput[] = [];
  if (query.status !== undefined) conditions.push({ status: { in: query.status } });
  if (query.location !== undefined) conditions.push({ locationStatus: { in: query.location } });
  if (query.minRating !== undefined) conditions.push({ rating: { gte: query.minRating } });
  if (query.tag !== undefined) conditions.push({ tags: { hasEvery: query.tag } });
  return { AND: conditions };
}

/**
 * Builds pagination metadata.
 *
 * @param page - Current page (1-based).
 * @param pageSize - Items per page.
 * @param total - Number of items matching the query.
 * @returns Pagination metadata.
 */
function pageMeta(page: number, pageSize: number, total: number): PageMeta {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

/**
 * Returns one page of books matching the filters, the optional text search
 * (`q`) and the requested sort order.
 *
 * With `sort=relevance` the matching ids are ranked by their search score
 * (ties broken by title); the catalogue of a single user is small, so ranking
 * the matching ids in memory is cheap. Other sort fields are handled by the
 * database.
 *
 * @param query - Validated pagination, filter, search and sorting options.
 * @returns Books of the requested page and pagination metadata.
 */
export async function listBooks(query: ListBooksQuery): Promise<BookPage> {
  const { page, pageSize, sort, order } = query;
  const where = buildBookFilter(query);

  let scores: Map<string, number> | undefined;
  if (query.q !== undefined) {
    const matches = await searchBooks(query.q);
    scores = new Map(matches.map((match) => [match.id, match.score]));
    where.id = { in: [...scores.keys()] };
  }

  if (sort === "relevance" && scores !== undefined) {
    const candidates = await prisma.book.findMany({ where, select: { id: true, title: true } });
    const direction = order === "asc" ? -1 : 1;
    candidates.sort(
      (a, b) =>
        direction * ((scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0)) ||
        a.title.localeCompare(b.title) ||
        a.id.localeCompare(b.id),
    );
    const pageIds = candidates.slice((page - 1) * pageSize, page * pageSize).map((book) => book.id);
    const books = await prisma.book.findMany({ where: { id: { in: pageIds } }, include: bookInclude });
    const byId = new Map(books.map((book) => [book.id, book]));
    const data = pageIds.flatMap((id) => byId.get(id) ?? []);
    return { data, meta: pageMeta(page, pageSize, candidates.length) };
  }

  const [data, total] = await prisma.$transaction([
    prisma.book.findMany({
      where,
      include: bookInclude,
      orderBy: buildOrderBy(sort === "relevance" ? "createdAt" : sort, order),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.book.count({ where }),
  ]);
  return { data, meta: pageMeta(page, pageSize, total) };
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
