/**
 * @packageDocumentation
 * Library view state (search, filters, sorting, page) stored in the URL query
 * string, so that a filtered view can be bookmarked, shared and restored with
 * the browser's back button.
 */
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import {
  BOOK_STATUSES,
  LOCATION_STATUSES,
  type BookSortField,
  type BookStatus,
  type ListBooksParams,
  type LocationStatus,
} from '../api/books'
import { SORT_LABELS } from '../lib/labels'

/** Books per page in the library grid. */
export const LIBRARY_PAGE_SIZE = 24

/**
 * Parses a comma-separated list, keeping only allowed values.
 *
 * @param raw - Raw parameter value.
 * @param allowed - Allowed values.
 */
function parseList<T extends string>(raw: string | null, allowed: readonly T[]): T[] | undefined {
  const items = (raw ?? '').split(',').filter((item): item is T => (allowed as readonly string[]).includes(item))
  return items.length > 0 ? items : undefined
}

/**
 * Converts URL search parameters into API list parameters. Invalid values
 * (e.g. edited by hand) are ignored instead of causing an API error.
 *
 * @param search - URL search parameters.
 * @returns Parameters for `GET /api/books`.
 */
export function parseLibraryParams(search: URLSearchParams): ListBooksParams {
  const params: ListBooksParams = { pageSize: LIBRARY_PAGE_SIZE }
  const q = search.get('q')?.trim()
  if (q) params.q = q
  const status = parseList<BookStatus>(search.get('status'), BOOK_STATUSES)
  if (status) params.status = status
  const location = parseList<LocationStatus>(search.get('location'), LOCATION_STATUSES)
  if (location) params.location = location
  const minRating = Number(search.get('minRating'))
  if (Number.isInteger(minRating) && minRating >= 1 && minRating <= 5) params.minRating = minRating
  const tag = search.get('tag')?.trim()
  if (tag) params.tag = [tag.toLowerCase()]
  const sort = search.get('sort')
  if (sort !== null && sort in SORT_LABELS && (sort !== 'relevance' || params.q)) params.sort = sort as BookSortField
  const order = search.get('order')
  if (order === 'asc' || order === 'desc') params.order = order
  const page = Number(search.get('page'))
  if (Number.isInteger(page) && page > 1) params.page = page
  return params
}

/** Changes applied by {@link useLibraryFilters}' `update` (`undefined` removes a parameter). */
export type LibraryFilterChanges = Partial<Record<'q' | 'status' | 'location' | 'minRating' | 'tag' | 'sort' | 'order' | 'page', string | undefined>>

/**
 * Reads and updates the library view state in the URL.
 *
 * @returns The parsed API parameters and an `update` function. Any change
 * other than `page` returns to the first page.
 */
export function useLibraryFilters() {
  const [search, setSearch] = useSearchParams()
  const params = useMemo(() => parseLibraryParams(search), [search])

  const update = useCallback(
    (changes: LibraryFilterChanges) => {
      setSearch(
        (previous) => {
          const next = new URLSearchParams(previous)
          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined || value === '') next.delete(key)
            else next.set(key, value)
          }
          if (!('page' in changes)) next.delete('page')
          // Relevance is only valid together with a search phrase.
          if (!next.get('q') && next.get('sort') === 'relevance') next.delete('sort')
          return next
        },
        { replace: 'q' in changes },
      )
    },
    [setSearch],
  )

  return { params, update }
}
