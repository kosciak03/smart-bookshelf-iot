/**
 * @packageDocumentation
 * Search box, status tabs, filters and sorting of the library view.
 */
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { BOOK_STATUSES, LOCATION_STATUSES, type BookSortField, type ListBooksParams } from '../api/books'
import type { LibraryFilterChanges } from '../hooks/useLibraryFilters'
import { useI18n } from '../i18n/core'

/** Delay between the last keystroke and the search request. */
export const SEARCH_DEBOUNCE_MS = 350

/**
 * Search input that updates the URL after the user stops typing.
 *
 * @param props.value - Current search phrase from the URL.
 * @param props.onSearch - Called with the trimmed phrase.
 */
export function SearchBox({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const { t } = useI18n()
  const [text, setText] = useState(value)

  // Follow external changes (back button, "clear filters").
  useEffect(() => setText(value), [value])

  useEffect(() => {
    if (text.trim() === value) return
    const timer = setTimeout(() => onSearch(text.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, value, onSearch])

  return (
    <label className="relative block">
      <span className="sr-only">{t('toolbar.searchLabel')}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={t('toolbar.searchPlaceholder')}
        className="w-full h-11 rounded-[var(--radius-ui)] border border-line bg-surface pl-9 pr-4 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
      />
    </label>
  )
}

/** Sort options offered without / with a search phrase. */
const SORT_OPTIONS: BookSortField[] = ['createdAt', 'updatedAt', 'title', 'author', 'rating', 'publishedYear']

/** Classes of the filter selects. */
const SELECT_CLASSES =
  'h-10 rounded-[var(--radius-ui)] border border-line bg-surface px-2 text-[15px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25'

/** Props of {@link LibraryToolbar}. */
export interface LibraryToolbarProps {
  params: ListBooksParams
  onChange: (changes: LibraryFilterChanges) => void
}

/**
 * Renders the search box, the reading-status tabs and the filter row.
 */
export function LibraryToolbar({ params, onChange }: LibraryToolbarProps) {
  const { t } = useI18n()
  const activeStatus = params.status?.length === 1 ? params.status[0] : undefined
  const sort: BookSortField = params.sort ?? (params.q ? 'relevance' : 'createdAt')
  const ascendingByDefault = sort === 'title' || sort === 'author'
  const order = params.order ?? (ascendingByDefault ? 'asc' : 'desc')
  const hasFilters = Boolean(params.q || params.status || params.location || params.minRating || params.tag)
  // Stable callback, so that re-renders do not restart the search debounce timer.
  const handleSearch = useCallback((q: string) => onChange({ q }), [onChange])

  return (
    <div className="space-y-4">
      <SearchBox value={params.q ?? ''} onSearch={handleSearch} />

      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1" aria-label={t('toolbar.statusNav')}>
        {[undefined, ...BOOK_STATUSES].map((status) => {
          const active = status === activeStatus && (status !== undefined || !params.status)
          return (
            <button
              key={status ?? 'ALL'}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onChange({ status })}
              className={`-mb-px h-11 shrink-0 border-b-2 px-3 text-[15px] transition-colors ${
                active ? 'border-accent font-bold text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {status === undefined ? t('toolbar.all') : t(`status.${status}`)}
            </button>
          )
        })}
      </nav>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 text-[15px]">
        <label className="flex items-center gap-2">
          <span className="text-muted">{t('toolbar.shelf')}</span>
          <select
            className={SELECT_CLASSES}
            value={params.location?.length === 1 ? params.location[0] : ''}
            onChange={(event) => onChange({ location: event.target.value })}
          >
            <option value="">{t('toolbar.any')}</option>
            {LOCATION_STATUSES.map((location) => (
              <option key={location} value={location}>
                {t(`location.${location}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-muted">{t('toolbar.rating')}</span>
          <select
            className={SELECT_CLASSES}
            value={params.minRating ?? ''}
            onChange={(event) => onChange({ minRating: event.target.value })}
          >
            <option value="">{t('toolbar.any')}</option>
            {[5, 4, 3, 2, 1].map((rating) => (
              <option key={rating} value={rating}>
                {rating === 5 ? t('toolbar.onlyFive') : t('toolbar.atLeast', { stars: '★'.repeat(rating) })}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-muted">{t('toolbar.sortBy')}</span>
          <select
            className={SELECT_CLASSES}
            value={sort}
            onChange={(event) => onChange({ sort: event.target.value, order: undefined })}
          >
            {(params.q ? (['relevance', ...SORT_OPTIONS] as BookSortField[]) : SORT_OPTIONS).map((option) => (
              <option key={option} value={option}>
                {t(`sort.${option}`)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => onChange({ order: order === 'asc' ? 'desc' : 'asc' })}
          className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-ui)] border border-line bg-surface px-3 text-ink hover:bg-raised"
          aria-label={order === 'asc' ? t('toolbar.ascendingAria') : t('toolbar.descendingAria')}
        >
          {order === 'asc' ? (
            <ArrowUpNarrowWide className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ArrowDownWideNarrow className="h-4 w-4" aria-hidden="true" />
          )}
          {order === 'asc' ? t('toolbar.ascending') : t('toolbar.descending')}
        </button>

        {params.tag?.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[13px] text-ink">
            {t('toolbar.tag', { tag })}
            <button type="button" onClick={() => onChange({ tag: undefined })} aria-label={t('toolbar.removeTag', { tag })}>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}

        {hasFilters && (
          <button
            type="button"
            onClick={() =>
              onChange({ q: undefined, status: undefined, location: undefined, minRating: undefined, tag: undefined })
            }
            className="text-[15px] text-ink underline-offset-2 hover:underline"
          >
            {t('toolbar.clearFilters')}
          </button>
        )}
      </div>
    </div>
  )
}
