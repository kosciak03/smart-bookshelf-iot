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
import { useI18n } from '../i18n/core'

/** Filter changes that reset every filter. */
const CLEAR_FILTERS = { q: undefined, status: undefined, location: undefined, minRating: undefined, tag: undefined }

/**
 * Renders the library page. Its state lives in the URL (see `useLibraryFilters`).
 */
export function LibraryPage() {
  const { t } = useI18n()
  const { params, update } = useLibraryFilters()
  const { data, error, isPending, isFetching, refetch } = useBookList(params)
  const filtered = Boolean(params.q || params.status || params.location || params.minRating || params.tag)

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="em text-3xl">{t('library.title')}</h1>
          {data && (
            <p className="text-muted" aria-live="polite">
              {t(filtered ? 'library.summaryFiltered' : 'library.summary', { count: data.meta.total })}
              {isFetching && t('library.updating')}
            </p>
          )}
        </div>
        <Link
          to="/books/new"
          className="hidden h-11 items-center gap-2 rounded-[var(--radius-ui)] bg-accent px-4 font-medium text-on-accent hover:bg-accent-hover sm:inline-flex"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('library.addBook')}
        </Link>
      </div>

      <ShelfStrip />

      <LibraryToolbar params={params} onChange={update} />

      {isPending && <Spinner label={t('library.loading')} />}

      {error && (
        <ErrorMessage error={error}>
          <button type="button" className="font-medium underline" onClick={() => void refetch()}>
            {t('common.tryAgain')}
          </button>
        </ErrorMessage>
      )}

      {data && data.data.length === 0 && (
        <EmptyState title={filtered ? t('library.emptyFiltered') : t('library.empty')}>
          {filtered ? (
            <button type="button" className="text-ink underline" onClick={() => update(CLEAR_FILTERS)}>
              {t('library.clearFilters')}
            </button>
          ) : (
            <Link to="/books/new" className="text-ink underline">
              {t('library.addFirst')}
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
