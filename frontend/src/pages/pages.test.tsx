/**
 * @packageDocumentation
 * Component tests of the pages, rendered inside the real router with a
 * mocked API.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { RatingStars } from '../components/RatingStars'
import { makeBook, mockApi, page, renderApp } from '../test/utils'

describe('LibraryPage', () => {
  it('lists books with status, progress and rating', async () => {
    mockApi(({ url }) =>
      url.startsWith('/api/books?')
        ? [
            200,
            page([
              makeBook({ id: 'a', title: 'Solaris', status: 'READING', pagesRead: 51, rating: 4 }),
              makeBook({ id: 'b', title: 'Dune', author: 'Frank Herbert', status: 'WANT_TO_READ' }),
            ]),
          ]
        : undefined,
    )
    renderApp('/')

    const solaris = (await screen.findByRole('heading', { name: 'Solaris' })).closest('article')!
    expect(within(solaris).getByText('Reading')).toBeInTheDocument()
    expect(within(solaris).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25')
    expect(within(solaris).getByRole('img', { name: 'Rated 4 out of 5' })).toBeInTheDocument()
    expect(screen.getByText('2 books in your library')).toBeInTheDocument()
  })

  it('sends filters from the URL and the tabs to the API', async () => {
    const requests = mockApi(({ url }) => (url.startsWith('/api/books?') ? [200, page([])] : undefined))
    const { router } = renderApp('/?minRating=4')

    await screen.findByText('No books match your filters')
    expect(requests.at(-1)?.url).toBe('/api/books?pageSize=24&minRating=4')

    await userEvent.click(within(screen.getByRole('navigation', { name: 'Reading status' })).getByRole('button', { name: 'Reading' }))
    await waitFor(() => expect(requests.at(-1)?.url).toBe('/api/books?pageSize=24&status=READING&minRating=4'))
    expect(router.state.location.search).toBe('?minRating=4&status=READING')
  })

  it('searches after the user stops typing and offers relevance sorting', async () => {
    const requests = mockApi(({ url }) => (url.startsWith('/api/books?') ? [200, page([makeBook()])] : undefined))
    renderApp('/')
    await screen.findByRole('heading', { name: 'Solaris' })

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search books' }), 'lem')
    await waitFor(() => expect(requests.at(-1)?.url).toBe('/api/books?pageSize=24&q=lem'))
    expect(requests.filter((request) => request.url.includes('q='))).toHaveLength(1)
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveValue('relevance')
  })

  it('shows an error with a retry button when the API fails', async () => {
    mockApi(() => [500, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }])
    renderApp('/')
    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('BookDetailsPage', () => {
  it('updates progress and rating through PATCH and shows the returned state', async () => {
    let book = makeBook({ status: 'READING', pagesRead: 20, startedAt: '2026-11-20T00:00:00.000Z' })
    const requests = mockApi(({ method, url, body }) => {
      if (url !== `/api/books/${book.id}`) return undefined
      if (method === 'PATCH') {
        const patch = body as { pagesRead?: number; rating?: number }
        // Simulate the backend reading rules: the last page finishes the book.
        book = { ...book, ...patch, ...(patch.pagesRead === book.pageCount ? { status: 'READ' as const } : {}) }
      }
      return [200, { data: book }]
    })
    renderApp(`/books/${book.id}`)

    const pages = await screen.findByRole('spinbutton', { name: "I'm on page" })
    await userEvent.clear(pages)
    await userEvent.type(pages, '204')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByRole('button', { name: /^Read$/ })).toHaveAttribute('aria-pressed', 'true'))
    expect(requests.find((request) => request.method === 'PATCH')?.body).toEqual({ pagesRead: 204 })

    await userEvent.click(screen.getByRole('button', { name: '5 stars' }))
    await waitFor(() => expect(requests.at(-1)?.body).toEqual({ rating: 5 }))
  })

  it('disables rating for books on the wish list', async () => {
    const book = makeBook()
    mockApi(({ url }) => (url === `/api/books/${book.id}` ? [200, { data: book }] : undefined))
    renderApp(`/books/${book.id}`)
    expect(await screen.findByRole('button', { name: '3 stars' })).toBeDisabled()
    expect(screen.getByText('Start reading the book to rate it.')).toBeInTheDocument()
  })

  it('shows "Book not found" for an unknown id', async () => {
    mockApi(() => undefined)
    renderApp('/books/unknown')
    expect(await screen.findByText('Book not found')).toBeInTheDocument()
  })
})

describe('AddBookPage', () => {
  const metadata = {
    isbn: '9780132350884',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    authors: ['Robert C. Martin'],
    description: 'A handbook.',
    coverUrl: null,
    publisher: 'Prentice Hall',
    publishedYear: 2008,
    pageCount: 464,
    tags: [],
    source: 'open-library',
  }

  it('looks up an ISBN, previews it and imports the book with the chosen status', async () => {
    const requests = mockApi(({ method, url }) => {
      if (url === '/api/isbn/0132350882') return [200, { data: metadata, meta: { cached: false } }]
      if (method === 'POST' && url === '/api/books/import') return [201, { data: makeBook({ id: 'imported', title: 'Clean Code' }) }]
      if (url === '/api/books/imported') return [200, { data: makeBook({ id: 'imported', title: 'Clean Code' }) }]
      return undefined
    })
    const { router } = renderApp('/books/new')

    await userEvent.type(screen.getByRole('textbox', { name: 'ISBN' }), '0132350882')
    await userEvent.click(screen.getByRole('button', { name: 'Look up' }))

    expect(await screen.findByRole('heading', { name: 'Clean Code' })).toBeInTheDocument()
    expect(screen.getByText(/Prentice Hall · 2008 · 464 pages/)).toBeInTheDocument()
    expect(screen.getByText('Source: Open Library')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Shelf' }), 'READING')
    await userEvent.click(screen.getByRole('button', { name: 'Add to my books' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/books/imported'))
    expect(requests.find((request) => request.url === '/api/books/import')?.body).toEqual({
      isbn: '9780132350884',
      status: 'READING',
    })
  })

  it('offers manual entry with the ISBN prefilled when the ISBN is unknown', async () => {
    mockApi(({ url }) =>
      url.startsWith('/api/isbn/') ? [404, { error: { code: 'ISBN_NOT_FOUND', message: 'No book found for ISBN 9788375780635' } }] : undefined,
    )
    renderApp('/books/new')

    await userEvent.type(screen.getByRole('textbox', { name: 'ISBN' }), '9788375780635')
    await userEvent.click(screen.getByRole('button', { name: 'Look up' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Enter the details manually' }))

    expect(await screen.findByRole('textbox', { name: 'ISBN' })).toHaveValue('9788375780635')
    expect(screen.getByRole('textbox', { name: /Title/ })).toHaveValue('')
  })

  it('validates the manual form and shows server field errors', async () => {
    const requests = mockApi(({ method }) =>
      method === 'POST'
        ? [409, { error: { code: 'ISBN_CONFLICT', message: 'A book with ISBN 9780132350884 already exists' } }]
        : undefined,
    )
    renderApp('/books/new?mode=manual')

    await userEvent.click(await screen.findByRole('button', { name: 'Add to my books' }))
    expect(screen.getByText('Title is required')).toBeInTheDocument()
    expect(requests).toHaveLength(0)

    await userEvent.type(screen.getByRole('textbox', { name: /Title/ }), 'Clean Code')
    await userEvent.type(screen.getByRole('textbox', { name: /Author/ }), 'Robert C. Martin')
    await userEvent.type(screen.getByRole('textbox', { name: 'ISBN' }), '9780132350884')
    await userEvent.click(screen.getByRole('button', { name: 'Add to my books' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('already exists')
    expect(requests[0]?.body).toEqual({
      title: 'Clean Code',
      author: 'Robert C. Martin',
      isbn: '9780132350884',
      status: 'WANT_TO_READ',
    })
  })
})

describe('RatingStars', () => {
  it('sets a rating and clears it when the current star is clicked again', async () => {
    const changes: Array<number | null> = []
    const { rerender } = render(<RatingStars value={null} onChange={(value) => changes.push(value)} />)
    await userEvent.click(screen.getByRole('button', { name: '4 stars' }))
    rerender(<RatingStars value={4} onChange={(value) => changes.push(value)} />)
    await userEvent.click(screen.getByRole('button', { name: '4 stars' }))
    expect(changes).toEqual([4, null])
  })
})
