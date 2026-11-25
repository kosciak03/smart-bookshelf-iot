/**
 * @packageDocumentation
 * Reading status, progress and rating controls of the book details page.
 *
 * The backend applies the reading rules (progress → status, status → dates),
 * so the panel only sends the user's intent and shows the returned state.
 */
import { Check } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { BOOK_STATUSES, type Book, type BookInput } from '../api/books'
import { useUpdateBook } from '../hooks/useBooks'
import { formatDate, STATUS_LABELS } from '../lib/labels'
import { ProgressBar } from './BookBadges'
import { ErrorMessage } from './Feedback'
import { RatingStars } from './RatingStars'

/**
 * Renders the reading controls for a book.
 *
 * @param props.book - Book to control.
 */
export function ReadingPanel({ book }: { book: Book }) {
  const update = useUpdateBook(book.id)
  const [pages, setPages] = useState(String(book.pagesRead))

  // Show the value derived by the server (e.g. pagesRead = pageCount after "Read").
  useEffect(() => setPages(String(book.pagesRead)), [book.pagesRead])

  const send = (patch: BookInput) => update.mutate(patch)

  const handleProgress = (event: FormEvent) => {
    event.preventDefault()
    const value = Number(pages)
    if (Number.isInteger(value) && value >= 0 && value !== book.pagesRead) send({ pagesRead: value })
  }

  const started = formatDate(book.startedAt)
  const finished = formatDate(book.finishedAt)

  return (
    <section className="space-y-5 rounded-xl border border-stone-200 bg-white p-5 shadow-sm" aria-label="Reading">
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Shelf</h2>
        <div className="inline-flex overflow-hidden rounded-md border border-stone-300" role="group" aria-label="Reading status">
          {BOOK_STATUSES.map((status) => {
            const active = book.status === status
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                disabled={update.isPending}
                onClick={() => !active && send({ status })}
                className={`flex items-center gap-1 px-3 py-1.5 text-sm transition-colors ${
                  active ? 'bg-leaf text-white' : 'bg-white text-stone-700 hover:bg-stone-50'
                } disabled:opacity-60`}
              >
                {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                {STATUS_LABELS[status]}
              </button>
            )
          })}
        </div>
        {book.status === 'READ' && (
          <p className="mt-2 text-xs text-stone-500">Choosing “Currently reading” again starts a re-read from page 0.</p>
        )}
        {book.status !== 'WANT_TO_READ' && (
          <p className="mt-2 text-xs text-stone-500">Moving the book back to “Want to read” clears progress and rating.</p>
        )}
      </div>

      {book.status !== 'WANT_TO_READ' && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Progress</h2>
          <ProgressBar pagesRead={book.pagesRead} pageCount={book.pageCount} />
        </div>
      )}

      {book.status !== 'READ' && (
        <form onSubmit={handleProgress} className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="block font-medium text-stone-700">Pages read</span>
            <input
              type="number"
              min={0}
              max={book.pageCount ?? undefined}
              value={pages}
              onChange={(event) => setPages(event.target.value)}
              className="mt-1 w-28 rounded-md border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/30"
            />
          </label>
          {book.pageCount !== null && <span className="pb-2 text-sm text-stone-500">of {book.pageCount}</span>}
          <button
            type="submit"
            disabled={update.isPending}
            className="rounded-md border border-leaf px-3 py-1.5 text-sm font-medium text-leaf-dark hover:bg-leaf/10 disabled:opacity-60"
          >
            Update progress
          </button>
          {book.status === 'READING' && (
            <button
              type="button"
              disabled={update.isPending}
              onClick={() => send({ status: 'READ' })}
              className="rounded-md bg-leaf px-3 py-1.5 text-sm font-medium text-white hover:bg-leaf-dark disabled:opacity-60"
            >
              I've finished it
            </button>
          )}
        </form>
      )}

      <div>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-500">My rating</h2>
        <RatingStars
          size="md"
          value={book.rating}
          disabled={book.status === 'WANT_TO_READ' || update.isPending}
          onChange={(rating) => send({ rating })}
        />
        {book.status === 'WANT_TO_READ' && <p className="text-xs text-stone-500">Start reading the book to rate it.</p>}
      </div>

      {(started || finished) && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {started && (
            <>
              <dt className="text-stone-500">Started</dt>
              <dd>{started}</dd>
            </>
          )}
          {finished && (
            <>
              <dt className="text-stone-500">Finished</dt>
              <dd>{finished}</dd>
            </>
          )}
        </dl>
      )}

      {update.error && <ErrorMessage error={update.error} />}
    </section>
  )
}
