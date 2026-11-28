/**
 * @packageDocumentation
 * Loading, error and empty-state indicators.
 */
import { CircleExclamationPoint, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { ApiError } from '../api/client'
import { en } from '../i18n/messages/en'
import { useI18n, type I18n, type MessageKey } from '../i18n/core'

/**
 * Spinner with an accessible label.
 *
 * @param props.label - Text announced to screen readers and shown next to the spinner.
 */
export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-muted" role="status">
      <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  )
}

/**
 * Turns any thrown value into a user-facing message in the current language.
 *
 * In English the backend's message is kept (it is more specific, e.g. which
 * ISBN was not found); in other languages known error codes are translated.
 *
 * @param error - Error from a query or mutation.
 * @param i18n - Translation helpers.
 */
export function errorMessage(error: unknown, i18n: Pick<I18n, 't' | 'language'>): string {
  if (error instanceof ApiError) {
    const known = error.code in en.errors
    if (i18n.language === 'en' && error.code !== 'NETWORK_ERROR') return error.message
    if (known) return i18n.t(`errors.${error.code}` as MessageKey)
    return error.message
  }
  if (error instanceof Error) return error.message
  return i18n.t('common.somethingWrong')
}

/**
 * Error box.
 *
 * @param props.error - Error to describe.
 * @param props.children - Optional actions (e.g. a retry button).
 */
export function ErrorMessage({ error, children }: { error: unknown; children?: ReactNode }) {
  const i18n = useI18n()
  return (
    <div
      className="flex items-start gap-3 rounded-[var(--radius-ui)] border border-danger/40 bg-danger-soft p-4 text-[15px] text-ink"
      role="alert"
    >
      <CircleExclamationPoint className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
      <div className="space-y-2">
        <p>{errorMessage(error, i18n)}</p>
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
    <div className="rounded-[var(--radius-ui)] border border-dashed border-line bg-surface px-6 py-12 text-center">
      <p className="em text-xl">{title}</p>
      {children && <div className="mt-2 text-muted">{children}</div>}
    </div>
  )
}
