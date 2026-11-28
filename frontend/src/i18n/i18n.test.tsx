/**
 * @packageDocumentation
 * Tests of the translations: dictionary completeness, Polish plural forms,
 * the language switch and translated API errors.
 */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeBook, mockApi, page, renderApp } from '../test/utils'
import { detectLanguage, LANGUAGE_STORAGE_KEY, translate } from './core'
import { en } from './messages/en'
import { pl } from './messages/pl'

/**
 * Lists every leaf path of a message tree.
 *
 * @param tree - Messages.
 * @param prefix - Path of the current node.
 */
function leafPaths(tree: object, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string' || 'other' in value) return [path]
    return leafPaths(value as object, path)
  })
}

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

describe('dictionaries', () => {
  it('have the same keys in English and Polish, with no empty messages', () => {
    expect(leafPaths(pl).sort()).toEqual(leafPaths(en).sort())
    for (const path of leafPaths(pl)) {
      expect(translate('pl', path as never, { count: 1 }).trim(), path).not.toBe('')
    }
  })

  it('give every Polish plural message the few and many forms', () => {
    const plurals = leafPaths(pl).filter((path) => {
      let node: unknown = pl
      for (const part of path.split('.')) node = (node as Record<string, unknown>)[part]
      return typeof node === 'object'
    })
    expect(plurals.length).toBeGreaterThan(5)
    for (const path of plurals) {
      let node: Record<string, string> = pl as never
      for (const part of path.split('.')) node = (node as never)[part]
      expect(node.few, path).toBeDefined()
      expect(node.many, path).toBeDefined()
    }
  })
})

describe('translate', () => {
  it('uses Polish plural rules', () => {
    expect(translate('pl', 'stats.booksCount', { count: 1 })).toBe('1 książka')
    expect(translate('pl', 'stats.booksCount', { count: 3 })).toBe('3 książki')
    expect(translate('pl', 'stats.booksCount', { count: 5 })).toBe('5 książek')
    expect(translate('pl', 'stats.booksCount', { count: 12 })).toBe('12 książek')
    expect(translate('pl', 'stats.booksCount', { count: 22 })).toBe('22 książki')
    expect(translate('en', 'stats.booksCount', { count: 1 })).toBe('1 book')
    expect(translate('en', 'stats.booksCount', { count: 2 })).toBe('2 books')
  })

  it('fills placeholders and formats numbers for the language', () => {
    expect(translate('en', 'pagination.page', { page: 2, total: 5 })).toBe('Page 2 of 5')
    expect(translate('pl', 'pagination.page', { page: 2, total: 5 })).toBe('Strona 2 z 5')
    expect(translate('pl', 'stats.pagesDetail', { count: 1312 })).toBe('1312 stron'.replace('1312', (1312).toLocaleString('pl-PL')))
  })

  it('detects Polish from the browser and prefers the saved choice', () => {
    expect(['en', 'pl']).toContain(detectLanguage())
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'pl')
    expect(detectLanguage()).toBe('pl')
  })
})

describe('language switch', () => {
  it('switches the whole interface to Polish and remembers the choice', async () => {
    mockApi(({ url }) => (url.startsWith('/api/books?') ? [200, page([makeBook({ status: 'READING', pagesRead: 51 })])] : undefined))
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Library' })).toBeInTheDocument()
    const group = screen.getAllByRole('group', { name: 'Language' })[0]!
    await userEvent.click(within(group).getByRole('button', { name: 'Polski' }))

    expect(await screen.findByRole('heading', { name: 'Biblioteka' })).toBeInTheDocument()
    expect(screen.getByText('1 książka w bibliotece')).toBeInTheDocument()
    expect(screen.getAllByText('Czytam').length).toBeGreaterThan(0)
    expect(screen.getByRole('searchbox', { name: 'Szukaj książek' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('pl')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pl')
  })

  it('translates API errors by their code', async () => {
    mockApi(({ method }) =>
      method === 'POST'
        ? [409, { error: { code: 'ISBN_CONFLICT', message: 'A book with ISBN 9780132350884 already exists' } }]
        : undefined,
    )
    renderApp('/books/new?mode=manual', 'pl')

    await userEvent.type(await screen.findByRole('textbox', { name: /Tytuł/ }), 'Clean Code')
    await userEvent.type(screen.getByRole('textbox', { name: /Autor/ }), 'Robert C. Martin')
    await userEvent.click(screen.getByRole('button', { name: 'Dodaj do biblioteki' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Książka o tym numerze ISBN jest już w bibliotece.'))
  })

  it('shows client-side validation messages in Polish', async () => {
    mockApi(() => undefined)
    renderApp('/books/new?mode=manual', 'pl')
    await userEvent.click(await screen.findByRole('button', { name: 'Dodaj do biblioteki' }))
    expect(screen.getByText('Tytuł jest wymagany')).toBeInTheDocument()
    expect(screen.getByText('Autor jest wymagany')).toBeInTheDocument()
  })
})
