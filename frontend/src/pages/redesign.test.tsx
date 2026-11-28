/**
 * @packageDocumentation
 * Tests of the redesigned UI: live shelf strip (click a slot to make it blink),
 * "Find on shelf" with its countdown, the "I'm on page" progress input and the
 * Auto / Light / Dark theme switch.
 */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ShelfSlot } from '../api/shelf'
import { resolveTheme, THEME_STORAGE_KEY } from '../lib/theme'
import { makeBook, makeShelf, makeSlot, mockApi, page, renderApp } from '../test/utils'

/** A slot holding "The Pragmatic Programmer". */
const BOOK = makeBook({
  id: 'pragmatic',
  title: 'The Pragmatic Programmer',
  author: 'David Thomas, Andrew Hunt',
  status: 'READING',
  pagesRead: 140,
  pageCount: 352,
  rfidUid: '04A1B2C3D4E502',
  locationStatus: 'ON_SHELF',
  slotId: makeSlot(2).id,
  slot: { id: makeSlot(2).id, shelfNumber: 1, slotNumber: 2 },
})

/**
 * Mocks the API with a shelf whose slot 2 holds {@link BOOK}; locate calls
 * switch slot 2 between blinking and dark.
 */
function mockShelfApi() {
  let slot2: ShelfSlot = makeSlot(2, {
    isOccupied: true,
    book: { id: BOOK.id, title: BOOK.title, author: BOOK.author, coverUrl: null, locationStatus: 'ON_SHELF' },
  })
  const blink = () => {
    slot2 = { ...slot2, highlight: 'LOCATE', isHighlighted: true, highlightUntil: new Date(Date.now() + 15_000).toISOString() }
    return { id: slot2.id, shelfNumber: 1, slotNumber: 2, until: slot2.highlightUntil }
  }
  const requests = mockApi(({ method, url }) => {
    if (url === '/api/shelf') return [200, { data: makeShelf([makeSlot(1), slot2, makeSlot(3)]) }]
    if (method === 'POST' && url === `/api/shelf/slots/${slot2.id}/locate`) return [200, { data: { slot: blink() } }]
    if (method === 'POST' && url === `/api/books/${BOOK.id}/locate`) return [200, { data: { slot: blink() } }]
    if (method === 'DELETE' && url === `/api/shelf/slots/${slot2.id}/locate`) {
      slot2 = { ...slot2, highlight: null, isHighlighted: false, highlightUntil: null }
      return [204, null]
    }
    if (url.startsWith('/api/books?')) return [200, page([BOOK])]
    if (url === `/api/books/${BOOK.id}`) return [200, { data: BOOK }]
    return undefined
  })
  return requests
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

afterEach(() => {
  localStorage.clear()
})

describe('shelf strip on the library page', () => {
  it('makes a slot blink when it is clicked and switches it off on a second click', async () => {
    const requests = mockShelfApi()
    renderApp('/')

    const shelf = await screen.findByRole('region', { name: 'Shelf 1 – live' })
    expect(within(shelf).getByText('1/3 occupied', { exact: false })).toBeInTheDocument()

    await userEvent.click(within(shelf).getByRole('button', { name: /Make slot 2 blink/ }))
    expect(requests.some((request) => request.method === 'POST' && request.url.endsWith('/locate'))).toBe(true)

    const blinking = await within(shelf).findByRole('button', { name: 'Slot 2 is blinking – turn off' })
    expect(blinking).toHaveAttribute('aria-pressed', 'true')
    expect(within(shelf).getByRole('status')).toHaveTextContent(/Blinking: S2 The Pragmatic Programmer · 1[45] s/)

    await userEvent.click(blinking)
    await within(shelf).findByRole('button', { name: /Make slot 2 blink/ })
    expect(requests.at(-1)).toMatchObject({ method: 'DELETE' })
  })
})

describe('Find on shelf', () => {
  it('blinks the book’s slot from its card and shows a countdown', async () => {
    mockShelfApi()
    renderApp('/')

    const card = (await screen.findByRole('heading', { name: 'The Pragmatic Programmer' })).closest('article')!
    await userEvent.click(within(card).getByRole('button', { name: 'Find on shelf' }))
    expect(await within(card).findByRole('button', { name: /Blinking · 1[45] s – turn off/ })).toBeInTheDocument()
    expect(within(card).getByText('S2')).toHaveClass('bg-locate')
  })
})

describe('book page', () => {
  it('shows the shelf card and saves the page the reader is on', async () => {
    const requests = mockShelfApi()
    renderApp(`/books/${BOOK.id}`)

    const shelfCard = await screen.findByRole('region', { name: 'On the shelf' })
    expect(within(shelfCard).getByText('SLOT 02')).toBeInTheDocument()
    expect(within(shelfCard).getByText('04A1B2C3D4E502')).toBeInTheDocument()

    const input = screen.getByRole('spinbutton', { name: "I'm on page" })
    await userEvent.clear(input)
    await userEvent.type(input, '400')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Enter a page between 0 and 352.')).toBeInTheDocument()
    expect(requests.some((request) => request.method === 'PATCH')).toBe(false)
  })
})

describe('colour theme', () => {
  it('switches between Auto, Light and Dark and remembers the choice', async () => {
    mockShelfApi()
    renderApp('/')
    await screen.findByRole('heading', { name: 'Library' })

    const group = screen.getAllByRole('group', { name: 'Colour theme' })[0]!
    expect(within(group).getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(within(group).getByRole('button', { name: 'Dark' }))
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'))
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    await userEvent.click(within(group).getByRole('button', { name: 'Light' }))
    await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'))

    await userEvent.click(within(group).getByRole('button', { name: 'Auto' }))
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('resolves Auto from the operating system setting', () => {
    expect(resolveTheme('dark')).toBe('dark')
    expect(resolveTheme('light')).toBe('light')
    // jsdom has no matchMedia: Auto falls back to light.
    expect(resolveTheme('system')).toBe('light')
  })
})
