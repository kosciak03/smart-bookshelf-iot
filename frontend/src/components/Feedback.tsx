/**
 * @packageDocumentation
 * Loading, error and empty-state indicators.
 */
import { CircleExclamationPoint, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { ApiError } from '../api/client'

/**
 * Spinner with an accessible label.
 *
 * @param props.label - Text announced to screen readers and shown next to the spinner.
 */
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-stone-500" role="status">
      <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

/**
 * Turns any thrown value into a user-facing message.
 *
 * @param error - Error from a query or mutation.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) return error.message
  return 'Something went wrong.'
}

/**
 * Error box.
 *
 * @param props.error - Error to describe.
 * @param props.children - Optional actions (e.g. a retry button).
 */
export function ErrorMessage({ error, children }: { error: unknown; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
      <CircleExclamationPoint className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="space-y-2">
        <p>{errorMessage(error)}</p>
        {children}
      </div>
    </div>
  )
}

/**
 * Placeholder shown when a list has no items.
 *
 * @param props.title - Headline.
 * @param props.children - Explanation and actions.
 */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-white/60 px-6 py-12 text-center">
      <p className="font-serif text-lg text-bark">{title}</p>
      {children && <div className="mt-2 text-sm text-stone-600">{children}</div>}
    </div>
  )
}
