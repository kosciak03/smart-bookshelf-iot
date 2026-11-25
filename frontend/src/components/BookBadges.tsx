/**
 * @packageDocumentation
 * Small presentational pieces of a book: status badge, location badge and
 * reading progress bar.
 */
import type { Book, BookStatus, LocationStatus } from '../api/books'
import { LOCATION_LABELS, progressPercent, STATUS_BADGE_CLASSES, STATUS_LABELS } from '../lib/labels'

/**
 * Coloured reading-status badge.
 *
 * @param props.status - Reading status.
 */
export function StatusBadge({ status }: { status: BookStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

/** Dot colours of the location badge. */
const LOCATION_DOTS: Record<LocationStatus, string> = {
  ON_SHELF: 'bg-emerald-500',
  OFF_SHELF: 'bg-amber-500',
  UNASSIGNED: 'bg-stone-300',
}

/**
 * Shelf location with the slot number, if assigned.
 *
 * @param props.book - Book to describe.
 */
export function LocationBadge({ book }: { book: Pick<Book, 'locationStatus' | 'slot'> }) {
  const slot = book.slot ? ` · slot ${book.slot.slotNumber}` : ''
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-stone-600">
      <span className={`h-2 w-2 rounded-full ${LOCATION_DOTS[book.locationStatus]}`} aria-hidden="true" />
      {LOCATION_LABELS[book.locationStatus]}
      {slot}
    </span>
  )
}

/**
 * Reading progress bar (`pagesRead / pageCount`).
 *
 * @param props.pagesRead - Pages read.
 * @param props.pageCount - Total pages, or `null` when unknown.
 */
export function ProgressBar({ pagesRead, pageCount }: { pagesRead: number; pageCount: number | null }) {
  const percent = progressPercent(pagesRead, pageCount)
  if (percent === null) return <p className="text-xs text-stone-500">{pagesRead} pages read</p>
  return (
    <div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Reading progress"
      >
        <div className="h-full rounded-full bg-leaf" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-xs text-stone-500">
        {pagesRead} / {pageCount} pages ({percent}%)
      </p>
    </div>
  )
}
