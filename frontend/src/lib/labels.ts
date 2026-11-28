/**
 * @packageDocumentation
 * Small display helpers shared by the UI. Texts are translated with
 * `useI18n()` (see `src/i18n`); this module only holds language-neutral data.
 */
import type { BookSortField, BookStatus } from '../api/books'

/** Tailwind class of the status dot. */
export const STATUS_DOT_CLASSES: Record<BookStatus, string> = {
  WANT_TO_READ: 'bg-status-want',
  READING: 'bg-status-reading',
  READ: 'bg-status-read',
}

/** Sort fields offered in the library (`relevance` only with a search phrase). */
export const SORT_FIELDS: readonly BookSortField[] = [
  'relevance',
  'createdAt',
  'updatedAt',
  'title',
  'author',
  'rating',
  'publishedYear',
]

/**
 * Reading progress in percent (0–100), or `null` when the page count is unknown.
 *
 * @param pagesRead - Pages read.
 * @param pageCount - Total pages, or `null`.
 */
export function progressPercent(pagesRead: number, pageCount: number | null): number | null {
  if (pageCount === null || pageCount <= 0) return null
  return Math.min(100, Math.round((pagesRead / pageCount) * 100))
}

/**
 * Formats an ISBN-13 with a hyphen after the prefix for readability (`978-0132350884`).
 *
 * @param isbn - Normalized ISBN-13.
 */
export function formatIsbn(isbn: string): string {
  return isbn.length === 13 ? `${isbn.slice(0, 3)}-${isbn.slice(3)}` : isbn
}
