/**
 * @packageDocumentation
 * Unit tests of the API client helpers, form conversion and URL state parsing.
 */
import { describe, expect, it, vi } from 'vitest'
import { apiRequest, ApiError, toQueryString } from '../api/client'
import { parseLibraryParams } from '../hooks/useLibraryFilters'
import { makeBook } from '../test/utils'
import {
  bookToFormValues,
  EMPTY_BOOK_FORM,
  formValuesToCreateInput,
  formValuesToPatch,
  parseTags,
  validateBookForm,
} from './book-form'
import { progressPercent } from './labels'

describe('API client', () => {
  it('serializes query parameters, skipping empty values and joining lists', () => {
    expect(toQueryString({ q: 'lem', status: ['READ', 'READING'], minRating: 4, tag: [], location: undefined, sort: '' })).toBe(
      '?q=lem&status=READ%2CREADING&minRating=4',
    )
    expect(toQueryString({})).toBe('')
  })

  it('throws ApiError with the backend error code and field errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: [
                { path: 'body.title', message: 'Too small' },
                { path: 'body.title', message: 'Second' },
                { path: 'body.rating', message: 'Out of range' },
              ],
            },
          },
          { status: 400 },
        ),
      ),
    )
    const error = await apiRequest('/books', { method: 'POST', body: {} }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', message: 'Invalid request body' })
    expect((error as ApiError).fieldErrors()).toEqual({ title: 'Too small', rating: 'Out of range' })
  })

  it('reports network failures and returns undefined for 204', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(apiRequest('/books')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' })

    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    await expect(apiRequest('/books/1', { method: 'DELETE' })).resolves.toBeUndefined()
  })
})

describe('book form', () => {
  const valid = { ...EMPTY_BOOK_FORM, title: ' Solaris ', author: 'Stanisław Lem' }

  it('validates required fields and number formats', () => {
    expect(validateBookForm(EMPTY_BOOK_FORM)).toEqual({ title: 'form.errors.titleRequired', author: 'form.errors.authorRequired' })
    expect(validateBookForm({ ...valid, isbn: '123', publishedYear: '99', pageCount: '-5', coverUrl: 'ftp://x' })).toEqual({
      isbn: 'form.errors.isbnDigits',
      publishedYear: 'form.errors.year',
      pageCount: 'form.errors.pages',
      coverUrl: 'form.errors.coverUrl',
    })
    expect(validateBookForm({ ...valid, isbn: '0-13-235088-2', pageCount: '464' })).toEqual({})
  })

  it('builds a create payload without empty fields', () => {
    expect(formValuesToCreateInput({ ...valid, pageCount: '204', tags: 'SF, polish, sf' })).toEqual({
      title: 'Solaris',
      author: 'Stanisław Lem',
      pageCount: 204,
      tags: ['sf', 'polish'],
      status: 'WANT_TO_READ',
    })
  })

  it('builds a patch with only the changed fields; cleared fields become null', () => {
    const book = makeBook({ publisher: 'Harcourt', tags: ['sf'] })
    const values = { ...bookToFormValues(book), title: 'Solaris (new ed.)', publisher: '', tags: 'sf' }
    expect(formValuesToPatch(values, book)).toEqual({ title: 'Solaris (new ed.)', publisher: null })
    expect(formValuesToPatch(bookToFormValues(book), book)).toEqual({})
  })

  it('parses tags', () => {
    expect(parseTags(' Fantasy ,, polish,FANTASY ')).toEqual(['fantasy', 'polish'])
  })
})

describe('library URL state', () => {
  it('parses valid parameters and ignores invalid ones', () => {
    const params = parseLibraryParams(
      new URLSearchParams('q=lem&status=READ,LOST&location=ON_SHELF&minRating=9&sort=rating&order=up&page=2&tag=SF'),
    )
    expect(params).toEqual({
      pageSize: 24,
      q: 'lem',
      status: ['READ'],
      location: ['ON_SHELF'],
      sort: 'rating',
      page: 2,
      tag: ['sf'],
    })
  })

  it('drops sort=relevance without a search phrase', () => {
    expect(parseLibraryParams(new URLSearchParams('sort=relevance')).sort).toBeUndefined()
  })
})

describe('progress', () => {
  it('computes the percentage, capped at 100, or null without a page count', () => {
    expect(progressPercent(51, 204)).toBe(25)
    expect(progressPercent(300, 204)).toBe(100)
    expect(progressPercent(10, null)).toBeNull()
  })
})
