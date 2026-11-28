/**
 * @packageDocumentation
 * Add-book view (`/books/new`): look up an ISBN and import the book, or enter
 * the details manually. `?mode=manual` opens the manual form, `&isbn=` fills
 * in the ISBN (used when a lookup finds nothing).
 */
import { ArrowLeft, ScanBarcode, Search } from 'lucide-react'
import { lazy, Suspense, useCallback, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { BOOK_STATUSES, type BookMetadata, type BookStatus } from '../api/books'
import { BookCover } from '../components/BookCover'
import { BookForm } from '../components/BookForm'
import { ErrorMessage, Spinner } from '../components/Feedback'
import { useCreateBook, useImportBook, useIsbnLookup } from '../hooks/useBooks'
import { EMPTY_BOOK_FORM, formValuesToCreateInput, type BookFormValues } from '../lib/book-form'
import { useI18n } from '../i18n/core'
import { formatIsbn } from '../lib/labels'

/** Barcode scanner, loaded on first use (the decoder library is large). */
const BarcodeScanner = lazy(() => import('../components/BarcodeScanner').then((module) => ({ default: module.BarcodeScanner })))

/** Human-readable metadata source. */
const SOURCE_LABELS: Record<BookMetadata['source'], string> = {
  'google-books': 'Google Books',
  'open-library': 'Open Library',
}

/**
 * Renders the add-book page with the "By ISBN" and "Manually" tabs.
 */
export function AddBookPage() {
  const { t } = useI18n()
  const [search, setSearch] = useSearchParams()
  const manual = search.get('mode') === 'manual'
  const isbn = search.get('isbn') ?? ''

  const switchTo = (mode: 'isbn' | 'manual', isbnValue = isbn) =>
    setSearch(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (mode === 'manual') next.set('mode', 'manual')
        else next.delete('mode')
        if (isbnValue) next.set('isbn', isbnValue)
        else next.delete('isbn')
        return next
      },
      { replace: true },
    )

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-[15px] text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('add.back')}
      </Link>
      <h1 className="em text-3xl">{t('add.title')}</h1>

      <div className="flex gap-1 border-b border-line" role="tablist">
        {(['isbn', 'manual'] as const).map((mode) => {
          const active = (mode === 'manual') === manual
          return (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchTo(mode)}
              className={`-mb-px border-b-2 px-3 py-2 text-[15px] font-medium ${
                active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {mode === 'isbn' ? t('add.byIsbn') : t('add.manually')}
            </button>
          )
        })}
      </div>

      {manual ? <ManualEntry isbn={isbn} /> : <IsbnImport initialIsbn={isbn} onManual={(value) => switchTo('manual', value)} />}
    </div>
  )
}

/**
 * ISBN lookup with a preview of the found metadata and an import button.
 *
 * @param props.initialIsbn - ISBN to prefill.
 * @param props.onManual - Switches to the manual form with the given ISBN.
 */
function IsbnImport({ initialIsbn, onManual }: { initialIsbn: string; onManual: (isbn: string) => void }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [input, setInput] = useState(initialIsbn)
  const [submitted, setSubmitted] = useState<string | null>(initialIsbn || null)
  const [status, setStatus] = useState<BookStatus>('WANT_TO_READ')
  const [scanning, setScanning] = useState(false)
  const lookup = useIsbnLookup(submitted)
  const importBook = useImportBook()

  const handleLookup = (event: FormEvent) => {
    event.preventDefault()
    const value = input.trim()
    if (value !== '') {
      importBook.reset()
      setSubmitted(value)
    }
  }

  // Stable callbacks: the scanner restarts the camera when they change.
  const handleScanned = useCallback((isbn: string) => {
    setScanning(false)
    setInput(isbn)
    setSubmitted(isbn)
  }, [])
  const closeScanner = useCallback(() => setScanning(false), [])

  const handleImport = (metadata: BookMetadata) =>
    importBook.mutate({ isbn: metadata.isbn, status }, { onSuccess: (book) => navigate(`/books/${book.id}`) })

  const notFound = lookup.error?.code === 'ISBN_NOT_FOUND'

  return (
    <div className="space-y-6">
      <form onSubmit={handleLookup} className="flex flex-wrap items-end gap-3">
        <label className="min-w-64 flex-1 text-[15px]">
          <span className="font-medium text-ink">{t('add.isbn')}</span>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t('add.isbnPlaceholder')}
            inputMode="numeric"
            className="mt-1 w-full rounded-[var(--radius-ui)] border border-line bg-surface px-3 py-2 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
          />
        </label>
        <button
          type="submit"
          disabled={lookup.isFetching}
          className="inline-flex items-center gap-2 rounded-[var(--radius-ui)] bg-accent px-4 py-2 text-[15px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          {t('add.lookUp')}
        </button>
        <button
          type="button"
          onClick={() => setScanning(true)}
          className="inline-flex items-center gap-2 rounded-[var(--radius-ui)] border border-line bg-surface px-4 py-2 text-[15px] font-medium hover:bg-raised"
        >
          <ScanBarcode className="h-4 w-4" aria-hidden="true" />
          {t('add.scan')}
        </button>
      </form>
      {scanning && (
        <Suspense fallback={<Spinner label={t('add.startingScanner')} />}>
          <BarcodeScanner onDetected={handleScanned} onClose={closeScanner} />
        </Suspense>
      )}
      <p className="text-[13px] text-muted">
        {t('add.isbnHint')}
      </p>

      {lookup.isFetching && <Spinner label={t('add.searching')} />}

      {lookup.error && !lookup.isFetching && (
        <ErrorMessage error={lookup.error}>
          {(notFound || lookup.error.code === 'METADATA_SOURCE_UNAVAILABLE') && (
            <button type="button" className="font-medium underline" onClick={() => onManual(submitted ?? '')}>
              {t('add.enterManually')}
            </button>
          )}
        </ErrorMessage>
      )}

      {lookup.data && !lookup.isFetching && (
        <article className="flex flex-col gap-5 rounded-[var(--radius-ui)] border border-line bg-surface p-5 sm:flex-row">
          <div className="w-28 shrink-0">
            <BookCover title={lookup.data.title} author={lookup.data.author ?? ''} coverUrl={lookup.data.coverUrl} />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h2 className="em text-xl">{lookup.data.title}</h2>
              <p className="em text-muted">{lookup.data.author ?? t('add.authorUnknown')}</p>
              <p className="mt-1 text-[13px] text-muted">
                {[
                  lookup.data.publisher,
                  lookup.data.publishedYear,
                  lookup.data.pageCount && t('add.pages', { count: lookup.data.pageCount }),
                  t('add.isbnValue', { isbn: formatIsbn(lookup.data.isbn) }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="mt-1 text-[13px] text-muted">{t('add.source', { source: SOURCE_LABELS[lookup.data.source] })}</p>
            </div>
            {lookup.data.description && <p className="line-clamp-4 text-[15px] text-ink">{lookup.data.description}</p>}

            {lookup.data.author === null ? (
              <ErrorMessage error={new Error(t('add.noAuthor'))}>
                <button type="button" className="font-medium underline" onClick={() => onManual(lookup.data.isbn)}>
                  {t('add.enterManually')}
                </button>
              </ErrorMessage>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-[15px]">
                  <span className="block font-medium text-ink">{t('add.shelf')}</span>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as BookStatus)}
                    className="mt-1 rounded-[var(--radius-ui)] border border-line bg-surface px-2 py-1.5 text-[15px]"
                  >
                    {BOOK_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {t(`status.${value}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={importBook.isPending}
                  onClick={() => handleImport(lookup.data)}
                  className="rounded-[var(--radius-ui)] bg-accent px-4 py-2 text-[15px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
                >
                  {importBook.isPending ? t('add.adding') : t('add.addToBooks')}
                </button>
              </div>
            )}
            {importBook.error && <ErrorMessage error={importBook.error} />}
          </div>
        </article>
      )}
    </div>
  )
}

/**
 * Manual entry form.
 *
 * @param props.isbn - ISBN to prefill.
 */
function ManualEntry({ isbn }: { isbn: string }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const create = useCreateBook()

  const handleSubmit = (values: BookFormValues) =>
    create.mutate(formValuesToCreateInput(values), { onSuccess: (book) => navigate(`/books/${book.id}`) })

  return (
    <div className="space-y-4">
      {create.error && create.error.details.length === 0 && <ErrorMessage error={create.error} />}
      <div className="rounded-[var(--radius-ui)] border border-line bg-surface p-6 ">
        <BookForm
          initialValues={{ ...EMPTY_BOOK_FORM, isbn }}
          onSubmit={handleSubmit}
          submitLabel={t('add.addToBooks')}
          submitting={create.isPending}
          serverErrors={create.error?.fieldErrors()}
          showStatus
        />
      </div>
    </div>
  )
}
