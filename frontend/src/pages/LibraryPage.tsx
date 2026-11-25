/**
 * @packageDocumentation
 * Library view (`/`): searchable, filterable grid of all books.
 */
import { BookPlus } from 'lucide-react'
import { Link } from 'react-router'
import { BookCard } from '../components/BookCard'
import { EmptyState, ErrorMessage, Spinner } from '../components/Feedback'
import { LibraryToolbar } from '../components/LibraryToolbar'
import { Pagination } from '../components/Pagination'
import { useBookList } from '../hooks/useBooks'
import { useLibraryFilters } from '../hooks/useLibraryFilters'

/**
 * Renders the library page. Its state lives in the URL (see `useLibraryFilters`).
 */
export function LibraryPage() {
  const { params, update } = useLibraryFilters()
  const { data, error, isPending, isFetching, refetch } = useBookList(params)
  const filtered = Boolean(params.q || params.status || params.location || params.minRating || params.tag)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">My books</h1>
          {data && (
            <p className="text-sm text-stone-600" aria-live="polite">
              {data.meta.total} {data.meta.total === 1 ? 'book' : 'books'}
              {filtered ? ' match your filters' : ' in your library'}
              {isFetching && ' · updating…'}
            </p>
          )}
        </div>
        <Link
          to="/books/new"
          className="inline-flex items-center gap-2 rounded-md bg-leaf px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-leaf-dark"
        >
          <BookPlus className="h-4 w-4" aria-hidden="true" />
          Add book
        </Link>
      </div>

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
            <button type="button" className="text-leaf-dark underline" onClick={() => update({ q: undefined, status: undefined, location: undefined, minRating: undefined, tag: undefined })}>
              Clear filters
            </button>
          ) : (
            <Link to="/books/new" className="text-leaf-dark underline">
              Add your first book
            </Link>
          )}
        </EmptyState>
      )}

      {data && data.data.length > 0 && (
        <>
          <div className={`grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 ${isFetching ? 'opacity-70' : ''}`}>
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
