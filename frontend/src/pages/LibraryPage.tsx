/**
 * @packageDocumentation
 * Library view (`/`): the live shelf strip, search, filters and the grid of
 * all books.
 */
import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { BookCard } from '../components/BookCard'
import { EmptyState, ErrorMessage, Spinner } from '../components/Feedback'
import { LibraryToolbar } from '../components/LibraryToolbar'
import { Pagination } from '../components/Pagination'
import { ShelfStrip } from '../components/ShelfStrip'
import { useBookList } from '../hooks/useBooks'
import { useLibraryFilters } from '../hooks/useLibraryFilters'

/** Filter changes that reset every filter. */
const CLEAR_FILTERS = { q: undefined, status: undefined, location: undefined, minRating: undefined, tag: undefined }

/**
 * Renders the library page. Its state lives in the URL (see `useLibraryFilters`).
 */
export function LibraryPage() {
  const { params, update } = useLibraryFilters()
  const { data, error, isPending, isFetching, refetch } = useBookList(params)
  const filtered = Boolean(params.q || params.status || params.location || params.minRating || params.tag)

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="em text-3xl">Library</h1>
          {data && (
            <p className="text-muted" aria-live="polite">
              {data.meta.total} {data.meta.total === 1 ? 'book' : 'books'}
              {filtered ? ' match your filters' : ' in your library'}
              {isFetching && ' · updating…'}
            </p>
          )}
        </div>
        <Link
          to="/books/new"
          className="hidden h-11 items-center gap-2 rounded-[var(--radius-ui)] bg-accent px-4 font-medium text-on-accent hover:bg-accent-hover sm:inline-flex"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add book
        </Link>
      </div>

      <ShelfStrip />

      <LibraryToolbar params={params} onChange={update} />

      {isPending && <Spinner label="Loading books…" />}

      {error && (
        <ErrorMessage error={error}>
          <button type="button" className="font-medium underline" onClick={() => void refetch()}>
            Try again
          </button>
        </ErrorMessage>
      )}

      {data && data.data.length === 0 && (
        <EmptyState title={filtered ? 'No books match your filters' : 'Your library is empty'}>
          {filtered ? (
            <button type="button" className="text-ink underline" onClick={() => update(CLEAR_FILTERS)}>
              Clear filters
            </button>
          ) : (
            <Link to="/books/new" className="text-ink underline">
              Add your first book
            </Link>
          )}
        </EmptyState>
      )}

      {data && data.data.length > 0 && (
        <>
          <div
            className={`grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 ${isFetching ? 'opacity-70' : ''}`}
          >
            {data.data.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
          <Pagination meta={data.meta} onPageChange={(page) => update({ page: String(page) })} />
        </>
      )}
    </div>
  )
}
