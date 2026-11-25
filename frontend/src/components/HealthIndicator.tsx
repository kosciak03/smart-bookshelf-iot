/**
 * @packageDocumentation
 * Small status badge showing backend and database connectivity.
 */
import { useHealthStatus, type ConnectionState } from '../hooks/useHealthStatus'

/** Visual presentation of each connection state. */
const STATE_STYLES: Record<ConnectionState, { dot: string; label: string }> = {
  loading: { dot: 'bg-stone-400 animate-pulse', label: 'Checking connection…' },
  ok: { dot: 'bg-emerald-500', label: 'API and database online' },
  degraded: { dot: 'bg-amber-500', label: 'API online, database unreachable' },
  offline: { dot: 'bg-red-500', label: 'API unreachable' },
}

/**
 * Renders the current health of the backend, refreshed periodically.
 *
 * @param props.variant - `card` (details panel) or `compact` (dot and label for the header).
 */
export function HealthIndicator({ variant = 'card' }: { variant?: 'card' | 'compact' }) {
  const { state, report, checkedAt } = useHealthStatus()
  const style = STATE_STYLES[state]

  if (variant === 'compact') {
    const latency = report?.databaseLatencyMs != null ? ` · DB ${report.databaseLatencyMs} ms` : ''
    return (
      <div className="flex items-center gap-2 text-xs text-stone-200" role="status" aria-live="polite" title={`${style.label}${latency}`}>
        <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
        <span className="hidden sm:inline">{state === 'ok' ? 'Online' : style.label}</span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-left" role="status" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} aria-hidden="true" />
        <span className="text-sm font-medium text-stone-800">{style.label}</span>
      </div>
      {(report !== null || checkedAt !== null) && (
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-stone-500">
          {report !== null && (
            <>
              <dt>Database latency</dt>
              <dd className="text-right">{report.databaseLatencyMs !== null ? `${report.databaseLatencyMs} ms` : '—'}</dd>
              <dt>API uptime</dt>
              <dd className="text-right">{report.uptimeSeconds} s</dd>
            </>
          )}
          {checkedAt !== null && (
            <>
              <dt>Last check</dt>
              <dd className="text-right">{checkedAt.toLocaleTimeString()}</dd>
            </>
          )}
        </dl>
      )}
    </div>
  )
}
