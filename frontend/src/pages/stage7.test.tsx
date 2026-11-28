/**
 * @packageDocumentation
 * Tests of the barcode scanner flow, the statistics page and their helpers.
 * The `html5-qrcode` library is mocked: jsdom has no camera.
 */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LibraryStats } from '../api/stats'
import { niceTicks } from '../components/charts'
import { hasValidEan13Checksum, isbnFromBarcode } from '../lib/isbn'
import { mockApi, renderApp } from '../test/utils'

/** Controls of the mocked scanner. */
const scanner = vi.hoisted(() => ({
  /** Success callback passed to `start()`; call it to simulate a decoded barcode. */
  onCode: null as ((code: string) => void) | null,
  /** Make `start()` fail (e.g. camera permission denied). */
  startError: null as Error | null,
  stop: vi.fn(async () => undefined),
}))

vi.mock('html5-qrcode', () => ({
  Html5QrcodeSupportedFormats: { EAN_13: 9 },
  Html5Qrcode: class {
    isScanning = false
    async start(_camera: unknown, _config: unknown, onCode: (code: string) => void) {
      if (scanner.startError) throw scanner.startError
      scanner.onCode = onCode
      this.isScanning = true
      return null
    }
    async stop() {
      this.isScanning = false
      await scanner.stop()
    }
    clear() {}
    async scanFile() {
      return '9788375780635'
    }
  },
}))

beforeEach(() => {
  scanner.onCode = null
  scanner.startError = null
  scanner.stop.mockClear()
})

describe('ISBN barcode helpers', () => {
  it('accepts only Bookland EAN-13 codes with a valid check digit', () => {
    expect(hasValidEan13Checksum('9780132350884')).toBe(true)
    expect(hasValidEan13Checksum('9780132350885')).toBe(false)
    expect(isbnFromBarcode('9780132350884')).toBe('9780132350884')
    expect(isbnFromBarcode('9791032305690')).toBe('9791032305690')
    // Magazine (ISSN, prefix 977) and a grocery EAN are not books.
    expect(isbnFromBarcode('9771234567003')).toBeNull()
    expect(isbnFromBarcode('5901234123457')).toBeNull()
    expect(isbnFromBarcode('9780132350885')).toBeNull()
  })
})

describe('chart axis', () => {
  it('produces round integer ticks that cover the maximum', () => {
    expect(niceTicks(0)).toEqual([0, 1])
    expect(niceTicks(3)).toEqual([0, 1, 2, 3])
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8])
    expect(niceTicks(23)).toEqual([0, 10, 20, 30])
  })
})

describe('barcode scanning on the add-book page', () => {
  const metadata = {
    isbn: '9788375780635',
    title: 'Ostatnie życzenie',
    author: 'Andrzej Sapkowski',
    authors: ['Andrzej Sapkowski'],
    description: null,
    coverUrl: null,
    publisher: 'SuperNowa',
    publishedYear: 2014,
    pageCount: 332,
    tags: [],
    source: 'google-books',
  }

  it('looks up the scanned ISBN and releases the camera', async () => {
    const requests = mockApi(({ url }) =>
      url === '/api/isbn/9788375780635' ? [200, { data: metadata, meta: { cached: false } }] : undefined,
    )
    renderApp('/books/new')

    await userEvent.click(screen.getByRole('button', { name: 'Scan barcode' }))
    const dialog = await screen.findByRole('dialog', { name: 'Scan ISBN barcode' })
    await waitFor(() => expect(scanner.onCode).not.toBeNull())

    // A non-book barcode is rejected with a hint, the camera keeps running.
    scanner.onCode?.('5901234123457')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('not an ISBN')

    scanner.onCode?.('9788375780635')
    expect(await screen.findByRole('heading', { name: 'Ostatnie życzenie' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'ISBN' })).toHaveValue('9788375780635')
    expect(requests.map((request) => request.url)).toContain('/api/isbn/9788375780635')
    await waitFor(() => expect(scanner.stop).toHaveBeenCalled())
  })

  it('explains a camera failure and still offers the photo fallback', async () => {
    scanner.startError = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
    mockApi(() => undefined)
    renderApp('/books/new')

    await userEvent.click(screen.getByRole('button', { name: 'Scan barcode' }))
    expect(await screen.findByText(/Camera access was denied/)).toBeInTheDocument()
    expect(screen.getByText('Use a photo of the barcode')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('StatsPage', () => {
  const stats: LibraryStats = {
    totals: { books: 8, wantToRead: 3, reading: 2, read: 3, onShelf: 2, offShelf: 1, unassigned: 5, pagesRead: 2574 },
    ratings: {
      average: 4.33,
      rated: 3,
      distribution: [
        { rating: 1, count: 0 },
        { rating: 2, count: 0 },
        { rating: 3, count: 0 },
        { rating: 4, count: 2 },
        { rating: 5, count: 1 },
      ],
    },
    year: {
      year: 2026,
      booksFinished: 3,
      pagesFinished: 2224,
      monthly: Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        books: index === 1 ? 1 : index === 9 ? 2 : 0,
        pages: index === 1 ? 1312 : index === 9 ? 912 : 0,
      })),
      availableYears: [2026, 2025],
    },
    currentlyReading: [
      { id: 'dune', title: 'Dune', author: 'Frank Herbert', coverUrl: null, pagesRead: 210, pageCount: 535, startedAt: null },
    ],
    topTags: [{ tag: 'programming', count: 4 }],
  }

  it('shows the yearly headline, tiles, charts and the reading list', async () => {
    mockApi(({ url }) => (url.startsWith('/api/stats') ? [200, { data: stats }] : undefined))
    renderApp('/stats')

    expect(await screen.findByText('Books finished in 2026')).toBeInTheDocument()
    expect(screen.getByText('2,224 pages in finished books')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Average rating\s*4.3 ★/ })).toHaveAttribute('href', '/?sort=rating')
    expect(screen.getByRole('button', { name: 'October 2026: 2 books, 912 pages' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dune' })).toHaveAttribute('href', '/books/dune')
    expect(screen.getByRole('link', { name: /programming/ })).toHaveAttribute('href', '/?tag=programming')
  })

  it('shows a tooltip on hover and can switch a chart to a table', async () => {
    mockApi(({ url }) => (url.startsWith('/api/stats') ? [200, { data: stats }] : undefined))
    renderApp('/stats')

    await userEvent.hover(await screen.findByRole('button', { name: /^February 2026/ }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('February 20261 book · 1,312 pages')

    await userEvent.click(screen.getAllByRole('button', { name: 'Show table' })[0]!)
    expect(screen.getByRole('cell', { name: 'October 2026' })).toBeInTheDocument()
  })

  it('requests another year when it is selected', async () => {
    const requests = mockApi(({ url }) => (url.startsWith('/api/stats') ? [200, { data: stats }] : undefined))
    renderApp('/stats')
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Year' }), '2025')
    await waitFor(() => expect(requests.at(-1)?.url).toBe('/api/stats?year=2025'))
  })
})
