/**
 * @packageDocumentation
 * Test helpers: rendering the app at a URL and a programmable `fetch` mock.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import type { Book } from '../api/books'
import { routes } from '../router'

/** A recorded API call. */
export interface RecordedRequest {
  method: string
  /** Path with query string, e.g. `/api/books?status=READ`. */
  url: string
  body: unknown
}

/** Handler returning `[status, body]` for a request, or `undefined` for 404. */
export type ApiHandler = (request: RecordedRequest) => [number, unknown] | undefined

/**
 * Replaces `fetch` with a mock that answers through `handler` and records
 * every request. `/api/health` always answers "ok".
 *
 * @param handler - Response factory.
 * @returns The list of recorded requests (filled as the app calls the API).
 */
export function mockApi(handler: ApiHandler): RecordedRequest[] {
  const requests: RecordedRequest[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const request: RecordedRequest = {
        method: init.method ?? 'GET',
        url: input,
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      }
      if (request.url === '/api/health') {
        return Response.json({ status: 'ok', database: 'up', databaseLatencyMs: 1, uptimeSeconds: 1, timestamp: '' })
      }
      requests.push(request)
      const [status, body] = handler(request) ?? [404, { error: { code: 'NOT_FOUND', message: 'Not found' } }]
      return status === 204 ? new Response(null, { status }) : Response.json(body, { status })
    }),
  )
  return requests
}

/**
 * Renders the whole application at a URL (memory router, fresh query cache).
 *
 * @param path - Initial URL, e.g. `/books/new`.
 * @returns Testing Library utilities and the router (for `router.state.location`).
 */
export function renderApp(path = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { ...utils, router }
}

/**
 * Builds a book with sensible defaults.
 *
 * @param overrides - Fields to change.
 */
export function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    isbn: null,
    title: 'Solaris',
    author: 'Stanisław Lem',
    description: null,
    coverUrl: null,
    publisher: null,
    publishedYear: null,
    tags: [],
    pageCount: 204,
    pagesRead: 0,
    rating: null,
    status: 'WANT_TO_READ',
    startedAt: null,
    finishedAt: null,
    locationStatus: 'UNASSIGNED',
    rfidUid: null,
    slotId: null,
    slot: null,
    createdAt: '2026-11-25T10:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
    ...overrides,
  }
}

/**
 * Builds a list response.
 *
 * @param books - Books of the page.
 */
export function page(books: Book[]) {
  return { data: books, meta: { page: 1, pageSize: 24, total: books.length, totalPages: books.length > 0 ? 1 : 0 } }
}
