/**
 * @packageDocumentation
 * Fallback view for unknown URLs.
 */
import { Link } from 'react-router'
import { EmptyState } from '../components/Feedback'

/**
 * Renders the "page not found" message.
 */
export function NotFoundPage() {
  return (
    <EmptyState title="Page not found">
      <Link to="/" className="text-ink underline">
        Go to my books
      </Link>
    </EmptyState>
  )
}
