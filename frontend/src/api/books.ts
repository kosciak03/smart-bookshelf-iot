/**
 * @packageDocumentation
 * Types and calls for the book catalogue endpoints (`/api/books`, `/api/isbn`).
 * The types mirror the backend responses.
 */
import { apiRequest } from './client'

/** Reading status of a book. */
export type BookStatus = 'WANT_TO_READ' | 'READING' | 'READ'
/** Physical location state of a book on the smart shelf. */
export type LocationStatus = 'UNASSIGNED' | 'ON_SHELF' | 'OFF_SHELF'

/** All reading statuses in workflow order. */
export const BOOK_STATUSES: readonly BookStatus[] = ['WANT_TO_READ', 'READING', 'READ']
/** All location states. */
export const LOCATION_STATUSES: readonly LocationStatus[] = ['ON_SHELF', 'OFF_SHELF', 'UNASSIGNED']

/** A book as returned by the API. */
export interface Book {
  id: string
  isbn: string | null
  title: string
  author: string
  description: string | null
  coverUrl: string | null
  publisher: string | null
  publishedYear: number | null
  tags: string[]
  pageCount: number | null
  pagesRead: number
  rating: number | null
  status: BookStatus
  /** ISO date-time. */
  startedAt: string | null
  /** ISO date-time. */
  finishedAt: string | null
  locationStatus: LocationStatus
  rfidUid: string | null
  slotId: string | null
  slot: { id: string; shelfNumber: number; slotNumber: number } | null
  createdAt: string
  updatedAt: string
}

/** Pagination metadata of a list response. */
export interface PageMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** Sort fields accepted by `GET /api/books`. */
export type BookSortField = 'relevance' | 'title' | 'author' | 'createdAt' | 'updatedAt' | 'rating' | 'publishedYear'

/** Query of `GET /api/books` (all optional; the backend applies defaults). */
export interface ListBooksParams {
  q?: string
  status?: BookStatus[]
  location?: LocationStatus[]
  minRating?: number
  tag?: string[]
  sort?: BookSortField
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

/** Editable book fields (body of `POST /api/books` and `PATCH /api/books/:id`). */
export interface BookInput {
  title?: string
  author?: string
  isbn?: string | null
  description?: string | null
  coverUrl?: string | null
  publisher?: string | null
  publishedYear?: number | null
  tags?: string[]
  pageCount?: number | null
  pagesRead?: number
  rating?: number | null
  status?: BookStatus
  /** ISO date (`2026-11-25`) or date-time. */
  startedAt?: string | null
  finishedAt?: string | null
}

/** Metadata found for an ISBN by `GET /api/isbn/:isbn`. */
export interface BookMetadata {
  isbn: string
  title: string
  author: string | null
  authors: string[]
  description: string | null
  coverUrl: string | null
  publisher: string | null
  publishedYear: number | null
  pageCount: number | null
  tags: string[]
  source: 'google-books' | 'open-library'
}

/**
 * Lists books.
 *
 * @param params - Search, filters, sorting and pagination.
 * @param signal - Abort signal.
 * @returns A page of books.
 */
export function listBooks(params: ListBooksParams, signal?: AbortSignal): Promise<{ data: Book[]; meta: PageMeta }> {
  return apiRequest('/books', { query: { ...params }, ...(signal ? { signal } : {}) })
}

/**
 * Fetches one book.
 *
 * @param id - Book id.
 * @param signal - Abort signal.
 * @returns The book.
 */
export async function getBook(id: string, signal?: AbortSignal): Promise<Book> {
  const response = await apiRequest<{ data: Book }>(`/books/${id}`, signal ? { signal } : {})
  return response.data
}

/**
 * Creates a book from manually entered data.
 *
 * @param input - Book fields (`title` and `author` required).
 * @returns The created book.
 */
export async function createBook(input: BookInput): Promise<Book> {
  return (await apiRequest<{ data: Book }>('/books', { method: 'POST', body: input })).data
}

/**
 * Updates a book partially.
 *
 * @param id - Book id.
 * @param patch - Fields to change (`null` clears a field).
 * @returns The updated book (with values derived by the reading rules).
 */
export async function updateBook(id: string, patch: BookInput): Promise<Book> {
  return (await apiRequest<{ data: Book }>(`/books/${id}`, { method: 'PATCH', body: patch })).data
}

/**
 * Deletes a book.
 *
 * @param id - Book id.
 */
export async function deleteBook(id: string): Promise<void> {
  await apiRequest<void>(`/books/${id}`, { method: 'DELETE' })
}

/**
 * Creates a book from ISBN metadata, optionally overriding fetched fields.
 *
 * @param input - ISBN plus overrides.
 * @returns The created book.
 */
export async function importBook(input: BookInput & { isbn: string }): Promise<Book> {
  return (await apiRequest<{ data: Book }>('/books/import', { method: 'POST', body: input })).data
}

/**
 * Looks up book metadata by ISBN without saving anything.
 *
 * @param isbn - ISBN-10 or ISBN-13 (hyphens allowed).
 * @param signal - Abort signal.
 * @returns The metadata found.
 */
export async function lookupIsbn(isbn: string, signal?: AbortSignal): Promise<BookMetadata> {
  const response = await apiRequest<{ data: BookMetadata }>(
    `/isbn/${encodeURIComponent(isbn)}`,
    signal ? { signal } : {},
  )
  return response.data
}
