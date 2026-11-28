/**
 * @packageDocumentation
 * Book card of the library grid.
 */
import { Link } from 'react-router'
import type { Book } from '../api/books'
import { useShelf } from '../hooks/useShelf'
import { BookCover } from './BookCover'
import { ProgressBar, SlotBadge, StatusBadge } from './BookBadges'
import { findSlot, LocateButton } from './LocateButton'
import { RatingStars } from './RatingStars'

/**
 * Renders a book with its cover, status, slot, progress, rating and the
 * "Find on shelf" action.
 *
 * @param props.book - Book to show.
 */
export function BookCard({ book }: { book: Book }) {
  const { data: shelf } = useShelf()
  const blinking = book.slot !== null && findSlot(shelf?.slots, book.slot.id)?.highlight === 'LOCATE'

  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius-ui)] border border-line bg-surface">
      <Link to={`/books/${book.id}`} tabIndex={-1} aria-hidden="true" className="block border-b border-line">
        <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} className="w-full rounded-none" />
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:p-3">
        <h3 className="em line-clamp-2 text-[15px] leading-snug">
          <Link to={`/books/${book.id}`} className="hover:underline">
            {book.title}
          </Link>
        </h3>
        <p className="em line-clamp-1 text-[13px] text-muted">{book.author}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={book.status} />
          {book.slot && <SlotBadge slotNumber={book.slot.slotNumber} blinking={blinking} />}
        </div>
        {book.status === 'READING' && <ProgressBar pagesRead={book.pagesRead} pageCount={book.pageCount} />}
        {book.status !== 'WANT_TO_READ' && book.rating !== null && <RatingStars value={book.rating} />}
        {book.slot && (
          <div className="mt-auto pt-1">
            <LocateButton bookId={book.id} slotId={book.slot.id} />
          </div>
        )}
      </div>
    </article>
  )
}
