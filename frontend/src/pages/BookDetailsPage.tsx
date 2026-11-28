/**
 * @packageDocumentation
 * Book page (`/books/:id`): cover with rating, progress, status and shelf card
 * on the left; title, author, details and description on the right. On phones
 * the cover sits next to the title and the controls follow below.
 */
import { ArrowLeft, Pencil, Trash } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { BookCover } from '../components/BookCover'
import { ProgressCard, RatingCard, ShelfCard, StatusControl } from '../components/BookControls'
import { EmptyState, ErrorMessage, Spinner } from '../components/Feedback'
import { useBook, useDeleteBook } from '../hooks/useBooks'
import { formatDate, formatIsbn, STATUS_DOT_CLASSES, STATUS_LABELS } from '../lib/labels'

/**
 * Renders the details of one book with reading controls, edit and delete.
 */
export function BookDetailsPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: book, error, isPending } = useBook(id)
  const remove = useDeleteBook()

  if (isPending) return <Spinner label="Loading book…" />
  if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
    return (
      <EmptyState title="Book not found">
        <Link to="/" className="text-ink underline">
          Back to the library
        </Link>
      </EmptyState>
    )
  }
  if (error || !book) return <ErrorMessage error={error} />

  const handleDelete = () => {
    if (!window.confirm(`Delete “${book.title}” from your library? This cannot be undone.`)) return
    remove.mutate(book.id, { onSuccess: () => navigate('/', { replace: true }) })
  }

  const meta = [
    book.publisher,
    book.publishedYear?.toString(),
    book.pageCount !== null ? `${book.pageCount} pages` : null,
    book.isbn ? `ISBN ${formatIsbn(book.isbn)}` : null,
    `Added ${formatDate(book.createdAt)}`,
  ].filter((entry): entry is string => Boolean(entry))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="inline-flex h-10 items-center gap-1 text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Library
        </Link>
        <div className="flex gap-2">
          <Link
            to={`/books/${book.id}/edit`}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-ui)] border border-line bg-surface px-3 hover:bg-raised"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit details
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={remove.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-ui)] border border-line bg-surface px-3 text-danger hover:bg-danger-soft disabled:opacity-60"
          >
            <Trash className="h-4 w-4" aria-hidden="true" />
            {remove.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
      {remove.error && <ErrorMessage error={remove.error} />}

      <div className="book-layout">
        <div className="area-cover">
          <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} size="lg" />
        </div>

        <header className="area-title min-w-0 space-y-1.5">
          <p className="inline-flex items-center gap-1.5 text-[13px] text-muted">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASSES[book.status]}`} aria-hidden="true" />
            {STATUS_LABELS[book.status]}
          </p>
          <h1 className="em text-2xl leading-tight md:text-4xl">{book.title}</h1>
          <p className="em text-muted md:text-lg">{book.author}</p>
        </header>

        <div className="area-controls space-y-3">
          <RatingCard book={book} />
          <ProgressCard book={book} />
          <StatusControl book={book} />
          <ShelfCard book={book} />
        </div>

        <div className="area-details min-w-0 space-y-5">
          <p className="flex flex-wrap gap-x-4 gap-y-1 border-y border-line py-2.5 text-[15px] text-muted">
            {meta.map((entry) => (
              <span key={entry}>{entry}</span>
            ))}
          </p>

          {book.description ? (
            <section aria-label="Description" className="max-w-2xl space-y-2">
              <h2 className="text-lg font-bold">About this book</h2>
              <p className="whitespace-pre-line text-[17px] leading-relaxed">{book.description}</p>
            </section>
          ) : (
            <p className="text-muted">No description yet.</p>
          )}

          {book.tags.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Tags">
              {book.tags.map((tag) => (
                <li key={tag}>
                  <Link
                    to={`/?tag=${encodeURIComponent(tag)}`}
                    className="inline-flex h-8 items-center rounded-[var(--radius-ui)] border border-line px-2.5 text-[14px] hover:bg-raised"
                  >
                    {tag}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
