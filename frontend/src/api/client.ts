/**
 * @packageDocumentation
 * Minimal JSON client for the Smart Bookshelf REST API.
 *
 * All requests go to the same origin (`/api/...`); in development Vite proxies
 * them to the backend. Errors follow the backend format
 * `{ error: { code, message, details? } }` and are thrown as {@link ApiError}.
 */

/** A single field-level validation problem reported by the backend. */
export interface ApiErrorDetail {
  /** Dotted path, e.g. `body.title` or `query.minRating`. */
  path: string
  message: string
}

/** Error thrown for every failed API call (HTTP error or network failure). */
export class ApiError extends Error {
  /** HTTP status; `0` when the server could not be reached. */
  readonly status: number
  /** Machine-readable error code, e.g. `VALIDATION_ERROR`, `ISBN_CONFLICT`. */
  readonly code: string
  /** Field-level details (validation errors), empty otherwise. */
  readonly details: ApiErrorDetail[]

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  /**
   * Returns field errors keyed by field name (the request location prefix such
   * as `body.` is removed), keeping the first message per field.
   */
  fieldErrors(): Record<string, string> {
    const errors: Record<string, string> = {}
    for (const detail of this.details) {
      const field = detail.path.replace(/^(body|query|params)\./, '')
      errors[field] ??= detail.message
    }
    return errors
  }
}

/** Query string values; `undefined`/empty values are skipped, arrays are joined with commas. */
export type QueryParams = Record<string, string | number | readonly string[] | undefined>

/** Options of {@link apiRequest}. */
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** JSON request body. */
  body?: unknown
  query?: QueryParams
  signal?: AbortSignal
}

/**
 * Serializes query parameters.
 *
 * @param query - Parameters to serialize.
 * @returns Query string with a leading `?`, or an empty string.
 */
export function toQueryString(query: QueryParams = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','))
    } else {
      params.set(key, String(value))
    }
  }
  const text = params.toString()
  return text === '' ? '' : `?${text}`
}

/**
 * Sends a request to the API and parses the JSON response.
 *
 * @param path - Path below `/api`, e.g. `/books`.
 * @param options - Method, body, query and abort signal.
 * @returns Parsed response body (`undefined` for HTTP 204).
 * @throws {@link ApiError} for non-2xx responses and network failures.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options
  let response: Response
  try {
    response = await fetch(`/api${path}${toQueryString(query)}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? null : JSON.stringify(body),
      signal: signal ?? null,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check that the backend is running.')
  }

  if (response.status === 204) return undefined as T

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: ApiErrorDetail[] } } | null)?.error
    throw new ApiError(
      response.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `Request failed (HTTP ${response.status})`,
      error?.details ?? [],
    )
  }
  return payload as T
}
