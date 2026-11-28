/**
 * @packageDocumentation
 * Reading controls under the cover on the book page: rating, progress
 * ("I'm on page …"), reading status and the smart shelf card.
 *
 * The backend applies the reading rules (progress → status, status → dates),
 * so the controls only send the user's intent and show the returned state.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { BOOK_STATUSES, type Book } from '../api/books'
import { useUpdateBook } from '../hooks/useBooks'
import { locateSecondsLeft, useNow, useShelf } from '../hooks/useShelf'
import { formatDate, LOCATION_LABELS, STATUS_LABELS } from '../lib/labels'
import { ProgressBar } from './BookBadges'
import { findSlot, LocateButton } from './LocateButton'
import { RatingStars } from './RatingStars'
import { slotStateText } from './ShelfStrip'

/**
 * Card with a small uppercase label.
 *
 * @param props.label - Card label.
 * @param props.aside - Optional element on the right of the label.
 */
function Card({ label, aside, children }: { label: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={label} className="space-y-2.5 rounded-[var(--radius-ui)] border border-line bg-surface p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted">{label}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

/**
 * Error line of a failed update.
 *
 * @param props.error - Error or `null`.
 */
function UpdateError({ error }: { error: Error | null }) {
  if (!error) return null
  return (
    <p className="text-[13px] text-danger" role="alert">
      {error.message}
    </p>
  )
}

/**
 * Star rating (only for books being read or already read).
 *
 * @param props.book - Book.
 */
export function RatingCard({ book }: { book: Book }) {
  const update = useUpdateBook(book.id)
  const disabled = book.status === 'WANT_TO_READ'
  return (
    <Card label="Rating">
      <RatingStars size="md" value={book.rating} disabled={disabled || update.isPending} onChange={(rating) => update.mutate({ rating })} />
      {disabled && <p className="text-[13px] text-muted">Start reading the book to rate it.</p>}
      <UpdateError error={update.error} />
    </Card>
  )
}

/**
 * Reading progress: the page the reader has reached, saved on demand. The last
 * page marks the book as read (backend rule).
 *
 * @param props.book - Book.
 */
export function ProgressCard({ book }: { book: Book }) {
  const update = useUpdateBook(book.id)
  const [page, setPage] = useState(String(book.pagesRead))
  const [invalid, setInvalid] = useState<string | null>(null)

  // Show the value derived by the server (e.g. pagesRead = pageCount after "Read").
  useEffect(() => setPage(String(book.pagesRead)), [book.pagesRead])

  const handleSave = (event: FormEvent) => {
    event.preventDefault()
    const value = Number(page)
    if (!Number.isInteger(value) || value < 0 || (book.pageCount !== null && value > book.pageCount)) {
      setInvalid(book.pageCount === null ? 'Enter a page number.' : `Enter a page between 0 and ${book.pageCount}.`)
      return
    }
    setInvalid(null)
    if (value !== book.pagesRead) update.mutate({ pagesRead: value })
  }

  return (
    <Card label="Progress">
      {book.pageCount !== null ? (
        <ProgressBar pagesRead={book.pagesRead} pageCount={book.pageCount} size="md" />
      ) : (
        <p className="text-[13px] text-muted">Add the number of pages (Edit details) to see the percentage.</p>
      )}
      <form onSubmit={handleSave} noValidate className="flex flex-wrap items-center gap-2">
        <label htmlFor="current-page" className="text-muted">
          I'm on page
        </label>
        <input
          id="current-page"
          type="number"
          inputMode="numeric"
          min={0}
          max={book.pageCount ?? undefined}
          value={page}
          onChange={(event) => setPage(event.target.value)}
          aria-invalid={invalid !== null}
          className="h-10 w-20 rounded-[var(--radius-ui)] border border-line bg-canvas px-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 aria-[invalid=true]:border-danger"
        />
        {book.pageCount !== null && <span className="text-muted">/ {book.pageCount}</span>}
        <button
          type="submit"
          disabled={update.isPending}
          className="ml-auto h-10 rounded-[var(--radius-ui)] border border-accent px-4 font-bold text-ink hover:bg-raised disabled:opacity-60"
        >
          Save
        </button>
      </form>
      {invalid && <p className="text-[13px] text-danger">{invalid}</p>}
      <UpdateError error={update.error} />
    </Card>
  )
}

/**
 * Segmented control of the reading status.
 *
 * @param props.book - Book.
 */
export function StatusControl({ book }: { book: Book }) {
  const update = useUpdateBook(book.id)
  const started = formatDate(book.startedAt)
  const finished = formatDate(book.finishedAt)
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 overflow-hidden rounded-[var(--radius-ui)] border border-line bg-surface" role="group" aria-label="Reading status">
        {BOOK_STATUSES.map((status, index) => {
          const active = book.status === status
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              disabled={update.isPending}
              onClick={() => !active && update.mutate({ status })}
              className={`h-11 px-1 text-[14px] transition-colors ${index > 0 ? 'border-l border-line' : ''} ${
                active ? 'bg-accent font-bold text-on-accent' : 'text-ink hover:bg-raised'
              } disabled:opacity-70`}
            >
              {STATUS_LABELS[status]}
            </button>
          )
        })}
      </div>
      {(started || finished) && (
        <p className="text-[13px] text-muted">
          {started && `Started ${started}`}
          {started && finished && ' · '}
          {finished && `Finished ${finished}`}
        </p>
      )}
      {book.status === 'READ' && <p className="text-[13px] text-muted">“Reading” again starts a re-read from page 0.</p>}
      {book.status !== 'WANT_TO_READ' && <p className="text-[13px] text-muted">Back to “Want to read” clears progress and rating.</p>}
      <UpdateError error={update.error} />
    </div>
  )
}

/**
 * Smart shelf card: slot, live state, RFID tag and "Find on shelf".
 *
 * @param props.book - Book.
 */
export function ShelfCard({ book }: { book: Book }) {
  const { data: shelf } = useShelf()
  const slot = book.slot ? findSlot(shelf?.slots, book.slot.id) : undefined
  const now = useNow(slot?.highlight === 'LOCATE')
  const state = slot ? slotStateText(slot, locateSecondsLeft(slot, now)) : LOCATION_LABELS[book.locationStatus]

  return (
    <Card
      label="On the shelf"
      aside={
        book.slot && (
          <span className="rounded-[var(--radius-ui)] bg-accent-soft px-2 py-0.5 text-[13px] font-medium">
            SLOT {String(book.slot.slotNumber).padStart(2, '0')}
          </span>
        )
      }
    >
      {book.slot ? (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[15px]">
            <dt className="text-muted">State</dt>
            <dd>{state}</dd>
            <dt className="text-muted">RFID</dt>
            <dd className="break-all">{book.rfidUid ?? 'No tag linked'}</dd>
          </dl>
          <LocateButton bookId={book.id} slotId={book.slot.id} variant="panel" />
          <p className="text-[13px] text-muted">The LED blinks for a few seconds and goes out as soon as the book is taken off.</p>
        </>
      ) : (
        <p className="text-[15px] text-muted">
          No shelf slot yet. {book.rfidUid ? 'Scan the book’s RFID sticker at the shelf – it gets the first free slot.' : 'Link an RFID sticker to place it on the shelf.'}
        </p>
      )}
    </Card>
  )
}
