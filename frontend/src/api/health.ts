/**
 * @packageDocumentation
 * Client for the backend health-check endpoint (`GET /api/health`).
 */

/** Connectivity state of a single backend dependency. */
export type DependencyStatus = 'up' | 'down'

/** JSON body returned by `GET /api/health` (mirrors the backend contract). */
export interface HealthResponse {
  status: 'ok' | 'degraded'
  database: DependencyStatus
  databaseLatencyMs: number | null
  uptimeSeconds: number
  timestamp: string
}

/**
 * Fetches the current backend health.
 *
 * The backend answers HTTP 503 with a valid body when the database is down,
 * so the body is parsed for both 200 and 503 responses.
 *
 * @param signal - Optional abort signal used to cancel the request.
 * @returns The parsed health report.
 * @throws When the backend is unreachable or returns an unexpected response.
 */
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/health', { signal: signal ?? null })
  if (!response.ok && response.status !== 503) {
    throw new Error(`Unexpected response: HTTP ${response.status}`)
  }
  return (await response.json()) as HealthResponse
}
