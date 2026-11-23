/**
 * @packageDocumentation
 * React hook that periodically polls the backend health endpoint.
 */
import { useEffect, useState } from 'react'
import { fetchHealth, type HealthResponse } from '../api/health'

/** Overall connection state shown in the UI. */
export type ConnectionState = 'loading' | 'ok' | 'degraded' | 'offline'

/** Value returned by {@link useHealthStatus}. */
export interface HealthStatus {
  state: ConnectionState
  /** Last successful report, `null` until the first response arrives. */
  report: HealthResponse | null
  /** Time of the most recent check attempt. */
  checkedAt: Date | null
}

/**
 * Polls `GET /api/health` every `intervalMs` milliseconds.
 *
 * @param intervalMs - Polling interval (default: 10 seconds).
 * @returns Current connection state and the latest health report.
 */
export function useHealthStatus(intervalMs = 10_000): HealthStatus {
  const [status, setStatus] = useState<HealthStatus>({ state: 'loading', report: null, checkedAt: null })

  useEffect(() => {
    let controller = new AbortController()

    const check = async (): Promise<void> => {
      controller.abort()
      controller = new AbortController()
      try {
        const report = await fetchHealth(controller.signal)
        setStatus({ state: report.status, report, checkedAt: new Date() })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setStatus({ state: 'offline', report: null, checkedAt: new Date() })
      }
    }

    void check()
    const timer = window.setInterval(() => void check(), intervalMs)
    return () => {
      window.clearInterval(timer)
      controller.abort()
    }
  }, [intervalMs])

  return status
}
