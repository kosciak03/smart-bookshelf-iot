/**
 * @packageDocumentation
 * Previous / next page navigation.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PageMeta } from '../api/books'

/** Classes of the page buttons. */
const BUTTON_CLASSES =
  'inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40'

/**
 * Renders the pagination bar (hidden when everything fits on one page).
 *
 * @param props.meta - Pagination metadata of the current response.
 * @param props.onPageChange - Called with the requested page number.
 */
export function Pagination({ meta, onPageChange }: { meta: PageMeta; onPageChange: (page: number) => void }) {
  if (meta.totalPages <= 1) return null
  return (
    <nav className="flex items-center justify-center gap-3" aria-label="Pagination">
      <button type="button" className={BUTTON_CLASSES} disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Previous
      </button>
      <span className="text-sm text-stone-600">
        Page {meta.page} of {meta.totalPages}
      </span>
      <button
        type="button"
        className={BUTTON_CLASSES}
        disabled={meta.page >= meta.totalPages}
        onClick={() => onPageChange(meta.page + 1)}
      >
        Next
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  )
}
