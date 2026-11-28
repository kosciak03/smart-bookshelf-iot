/**
 * @packageDocumentation
 * Display labels and small formatting helpers shared by the UI.
 */
import type { BookSortField, BookStatus, LocationStatus } from '../api/books'

/** Human-readable reading status. */
export const STATUS_LABELS: Record<BookStatus, string> = {
  WANT_TO_READ: 'Want to read',
  READING: 'Reading',
  READ: 'Read',
}

/** Tailwind class of the status dot. */
export const STATUS_DOT_CLASSES: Record<BookStatus, string> = {
  WANT_TO_READ: 'bg-status-want',
  READING: 'bg-status-reading',
  READ: 'bg-status-read',
}

/** Human-readable shelf location. */
export const LOCATION_LABELS: Record<LocationStatus, string> = {
  ON_SHELF: 'On the shelf',
  OFF_SHELF: 'Taken off the shelf',
  UNASSIGNED: 'No shelf slot',
}

/** Human-readable sort options (`relevance` only makes sense with a search phrase). */
export const SORT_LABELS: Record<BookSortField, string> = {
  relevance: 'Relevance',
  createdAt: 'Date added',
  updatedAt: 'Last updated',
  title: 'Title',
  author: 'Author',
  rating: 'Rating',
  publishedYear: 'Publication year',
}

/**
 * Formats an ISO date for display (e.g. `25 Nov 2026`).
 *
 * @param iso - ISO date or date-time, or `null`.
 * @returns Formatted date, or `null` for missing input.
 */
export function formatDate(iso: string | null): string | null {
  if (iso === null) return null
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

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
 * Formats an ISBN-13 with hyphens after the prefix for readability (`978-0132350884`).
 *
 * @param isbn - Normalized ISBN-13.
 */
export function formatIsbn(isbn: string): string {
  return isbn.length === 13 ? `${isbn.slice(0, 3)}-${isbn.slice(3)}` : isbn
}
