/**
 * @packageDocumentation
 * Fallback view for unknown URLs.
 */
import { Link } from 'react-router'
import { EmptyState } from '../components/Feedback'
import { useI18n } from '../i18n/core'

/**
 * Renders the "page not found" message.
 */
export function NotFoundPage() {
  const { t } = useI18n()
  return (
    <EmptyState title={t('notFound.title')}>
      <Link to="/" className="text-ink underline">
        {t('notFound.link')}
      </Link>
    </EmptyState>
  )
}
