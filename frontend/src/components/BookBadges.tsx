/**
 * @packageDocumentation
 * Small presentational pieces of a book: status chip, slot chip, location
 * line and reading progress bar.
 */
import type { Book, BookStatus, LocationStatus } from '../api/books'
import { useI18n } from '../i18n/core'
import { progressPercent, STATUS_DOT_CLASSES } from '../lib/labels'

/**
 * Reading-status chip with a coloured dot.
 *
 * @param props.status - Reading status.
 */
export function StatusBadge({ status }: { status: BookStatus }) {
  const { t } = useI18n()
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-[var(--radius-ui)] border border-line px-2 text-[13px] text-ink">
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASSES[status]}`} aria-hidden="true" />
      {t(`status.${status}`)}
    </span>
  )
}

/**
 * Chip with the shelf slot number (`S2`), blue while the slot blinks.
 *
 * @param props.slotNumber - Slot number.
 * @param props.blinking - Whether the slot's LED is blinking for "find".
 */
export function SlotBadge({ slotNumber, blinking = false }: { slotNumber: number; blinking?: boolean }) {
  const { t } = useI18n()
  return (
    <span
      className={`inline-flex h-6 items-center rounded-[var(--radius-ui)] px-2 text-[13px] font-medium ${
        blinking ? 'bg-locate text-white' : 'bg-accent-soft text-ink'
      }`}
      title={t('book.slotTitle', { number: slotNumber })}
    >
      {t('shelf.slotShort', { number: slotNumber })}
    </span>
  )
}

/** Dot colours of the location line. */
const LOCATION_DOTS: Record<LocationStatus, string> = {
  ON_SHELF: 'bg-status-read',
  OFF_SHELF: 'bg-warn',
  UNASSIGNED: 'bg-track',
}

/**
 * Shelf location with the slot number, if assigned.
 *
 * @param props.book - Book to describe.
 */
export function LocationBadge({ book }: { book: Pick<Book, 'locationStatus' | 'slot'> }) {
  const { t } = useI18n()
  const slot = book.slot ? ` · ${t('shelf.slotShort', { number: book.slot.slotNumber })}` : ''
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
      <span className={`h-2 w-2 rounded-full ${LOCATION_DOTS[book.locationStatus]}`} aria-hidden="true" />
      {t(`location.${book.locationStatus}`)}
      {slot}
    </span>
  )
}

/**
 * Reading progress bar (`pagesRead / pageCount`).
 *
 * @param props.pagesRead - Pages read.
 * @param props.pageCount - Total pages, or `null` when unknown.
 * @param props.size - Bar thickness.
 */
export function ProgressBar({
  pagesRead,
  pageCount,
  size = 'sm',
}: {
  pagesRead: number
  pageCount: number | null
  size?: 'sm' | 'md'
}) {
  const { t } = useI18n()
  const percent = progressPercent(pagesRead, pageCount)
  if (percent === null) return <p className="text-[13px] text-muted">{t('book.pagesRead', { count: pagesRead })}</p>
  const height = size === 'sm' ? 'h-1' : 'h-1.5'
  return (
    <div>
      <div
        className={`${height} w-full overflow-hidden rounded-full bg-track`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={t('book.progressAria')}
      >
        <div className={`${height} rounded-full bg-accent`} style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-[13px] text-muted">{t('book.progress', { read: pagesRead, total: pageCount ?? 0, percent })}</p>
    </div>
  )
}
