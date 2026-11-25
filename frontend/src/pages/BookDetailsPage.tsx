/**
 * @packageDocumentation
 * Book details view (`/books/:id`).
 */
import { ArrowLeft, Pencil, Trash } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { LocationBadge, StatusBadge } from '../components/BookBadges'
import { BookCover } from '../components/BookCover'
import { EmptyState, ErrorMessage, Spinner } from '../components/Feedback'
import { ReadingPanel } from '../components/ReadingPanel'
import { useBook, useDeleteBook } from '../hooks/useBooks'
import { formatDate, formatIsbn } from '../lib/labels'

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
        <Link to="/" className="text-leaf-dark underline">
          Back to my books
        </Link>
      </EmptyState>
    )
  }
  if (error || !book) return <ErrorMessage error={error} />

  const handleDelete = () => {
    if (!window.confirm(`Delete “${book.title}” from your library? This cannot be undone.`)) return
    remove.mutate(book.id, { onSuccess: () => navigate('/', { replace: true }) })
  }

  const details: Array<[string, string | null]> = [
    ['Publisher', book.publisher],
    ['Published', book.publishedYear?.toString() ?? null],
    ['Pages', book.pageCount?.toString() ?? null],
    ['ISBN', book.isbn ? formatIsbn(book.isbn) : null],
    ['Added', formatDate(book.createdAt)],
  ]

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-bark">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        My books
      </Link>

      <div className="grid gap-8 md:grid-cols-[200px_1fr]">
        <div className="mx-auto w-40 md:w-full">
          <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} />
        </div>

        <div className="space-y-6">
          <header className="space-y-2">
            <h1 className="font-serif text-3xl font-bold leading-tight">{book.title}</h1>
            <p className="text-lg text-stone-700">by {book.author}</p>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={book.status} />
              <LocationBadge book={book} />
            </div>
          </header>

          <ReadingPanel book={book} />

          {book.description && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Description</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-stone-800">{book.description}</p>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Book details</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
              {details
                .filter((entry): entry is [string, string] => entry[1] !== null)
                .map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-stone-500">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
            </dl>
            {book.tags.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Tags">
                {book.tags.map((tag) => (
                  <li key={tag}>
                    <Link
                      to={`/?tag=${encodeURIComponent(tag)}`}
                      className="rounded-full bg-bark/10 px-2.5 py-1 text-xs text-bark hover:bg-bark/20"
                    >
                      {tag}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-wrap gap-3 border-t border-stone-200 pt-4">
            <Link
              to={`/books/${book.id}/edit`}
              className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm hover:bg-stone-50"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit details
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={remove.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              <Trash className="h-4 w-4" aria-hidden="true" />
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
          {remove.error && <ErrorMessage error={remove.error} />}
        </div>
      </div>
    </div>
  )
}
