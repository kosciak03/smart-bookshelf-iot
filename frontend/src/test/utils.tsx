/**
 * @packageDocumentation
 * Test helpers: rendering the app at a URL and a programmable `fetch` mock.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import type { Book } from '../api/books'
import type { ShelfSlot, ShelfState } from '../api/shelf'
import { I18nProvider, type Language } from '../i18n/core'
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
      // Background shelf polling is answered with an empty shelf unless the test handles it.
      const isShelfPoll = request.method === 'GET' && request.url === '/api/shelf'
      const answer = handler(request)
      if (isShelfPoll && answer === undefined) return Response.json({ data: makeShelf([]) })
      if (!isShelfPoll) requests.push(request)
      const [status, body] = answer ?? [404, { error: { code: 'NOT_FOUND', message: 'Not found' } }]
      return status === 204 ? new Response(null, { status }) : Response.json(body, { status })
    }),
  )
  return requests
}

/**
 * Renders the whole application at a URL (memory router, fresh query cache).
 *
 * @param path - Initial URL, e.g. `/books/new`.
 * @param language - UI language (English by default).
 * @returns Testing Library utilities and the router (for `router.state.location`).
 */
export function renderApp(path = '/', language: Language = 'en') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const utils = render(
    <I18nProvider initialLanguage={language}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nProvider>,
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

/**
 * Builds a shelf state with the given slots (11 white/off LEDs by default).
 *
 * @param slots - Slots of shelf 1.
 */
export function makeShelf(slots: ShelfSlot[]): ShelfState {
  return {
    shelfNumber: 1,
    device: { online: true, lastSeen: '2026-11-28T10:00:00.000Z', rssi: -55 },
    broker: { connected: true },
    slots,
    leds: {
      version: 1,
      pixels: Array.from({ length: 11 }, (_, index) => ({ color: index % 2 === 0 ? '#FFFFFF' : '#000000', effect: 'solid' as const })),
    },
    pendingTag: null,
    expected: null,
  }
}

/**
 * Builds a shelf slot.
 *
 * @param slotNumber - Slot number (1-based).
 * @param overrides - Fields to change.
 */
export function makeSlot(slotNumber: number, overrides: Partial<ShelfSlot> = {}): ShelfSlot {
  return {
    id: `00000000-0000-4000-8000-00000000010${slotNumber}`,
    slotNumber,
    fsrChannel: slotNumber - 1,
    ledStartIdx: 2 * slotNumber - 1,
    ledEndIdx: 2 * slotNumber - 1,
    isOccupied: false,
    isHighlighted: false,
    highlight: null,
    highlightUntil: null,
    book: null,
    ...overrides,
  }
}
