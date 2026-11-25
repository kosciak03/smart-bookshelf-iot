/**
 * @packageDocumentation
 * Book tile of the library grid.
 */
import { Link } from 'react-router'
import type { Book } from '../api/books'
import { BookCover } from './BookCover'
import { LocationBadge, ProgressBar, StatusBadge } from './BookBadges'
import { RatingStars } from './RatingStars'

/**
 * Renders a book with its cover, status, progress, rating and shelf location.
 *
 * @param props.book - Book to show.
 */
export function BookCard({ book }: { book: Book }) {
  return (
    <article className="group flex flex-col gap-2">
      <Link to={`/books/${book.id}`} className="block transition-transform group-hover:-translate-y-0.5">
        <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} />
      </Link>
      <div className="space-y-1">
        <h3 className="line-clamp-2 font-serif text-sm font-bold leading-snug">
          <Link to={`/books/${book.id}`} className="hover:underline">
            {book.title}
          </Link>
        </h3>
        <p className="line-clamp-1 text-xs text-stone-600">by {book.author}</p>
        <StatusBadge status={book.status} />
        {book.status === 'READING' && <ProgressBar pagesRead={book.pagesRead} pageCount={book.pageCount} />}
        {book.status !== 'WANT_TO_READ' && (
          <div>
            <RatingStars value={book.rating} />
          </div>
        )}
        <LocationBadge book={book} />
      </div>
    </article>
  )
}
