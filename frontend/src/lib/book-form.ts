/**
 * @packageDocumentation
 * Conversion between the book form (string inputs) and API payloads, plus
 * client-side validation. Kept free of React so it can be unit-tested.
 *
 * The server validates everything again; client checks only give faster
 * feedback for the obvious mistakes.
 */
import type { Book, BookInput, BookStatus } from '../api/books'
import type { MessageKey } from '../i18n/core'

/** Values of the book form (every input is a string, as in the DOM). */
export interface BookFormValues {
  title: string
  author: string
  isbn: string
  publisher: string
  publishedYear: string
  pageCount: string
  coverUrl: string
  /** Comma-separated tags. */
  tags: string
  description: string
  status: BookStatus
}

/** Form field names. */
export type BookFormField = keyof BookFormValues

/** Empty form for a new book. */
export const EMPTY_BOOK_FORM: BookFormValues = {
  title: '',
  author: '',
  isbn: '',
  publisher: '',
  publishedYear: '',
  pageCount: '',
  coverUrl: '',
  tags: '',
  description: '',
  status: 'WANT_TO_READ',
}

/**
 * Fills the form from a stored book.
 *
 * @param book - Book to edit.
 */
export function bookToFormValues(book: Book): BookFormValues {
  return {
    title: book.title,
    author: book.author,
    isbn: book.isbn ?? '',
    publisher: book.publisher ?? '',
    publishedYear: book.publishedYear?.toString() ?? '',
    pageCount: book.pageCount?.toString() ?? '',
    coverUrl: book.coverUrl ?? '',
    tags: book.tags.join(', '),
    description: book.description ?? '',
    status: book.status,
  }
}

/**
 * Splits the comma-separated tag input.
 *
 * @param text - Tag input.
 * @returns Trimmed, lower-cased, unique tags.
 */
export function parseTags(text: string): string[] {
  return [...new Set(text.split(',').map((tag) => tag.trim().toLowerCase()).filter((tag) => tag !== ''))]
}

/**
 * Parses an optional integer input.
 *
 * @param text - Input value.
 * @returns The number, `null` for an empty input, or `NaN` when invalid.
 */
function parseOptionalInt(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN
}

/**
 * Validates the form.
 *
 * @param values - Form values.
 * @returns Message key of the error per invalid field; empty when the form is valid.
 */
export function validateBookForm(values: BookFormValues): Partial<Record<BookFormField, MessageKey>> {
  const errors: Partial<Record<BookFormField, MessageKey>> = {}
  if (values.title.trim() === '') errors.title = 'form.errors.titleRequired'
  if (values.author.trim() === '') errors.author = 'form.errors.authorRequired'

  const isbnDigits = values.isbn.replace(/[\s-]/g, '')
  if (isbnDigits !== '' && !/^(\d{9}[\dXx]|\d{13})$/.test(isbnDigits)) {
    errors.isbn = 'form.errors.isbnDigits'
  }

  const year = parseOptionalInt(values.publishedYear)
  if (year !== null && (Number.isNaN(year) || year < 1450 || year > 2100)) {
    errors.publishedYear = 'form.errors.year'
  }

  const pages = parseOptionalInt(values.pageCount)
  if (pages !== null && (Number.isNaN(pages) || pages < 1)) errors.pageCount = 'form.errors.pages'

  const cover = values.coverUrl.trim()
  if (cover !== '' && !/^https?:\/\/\S+$/i.test(cover)) errors.coverUrl = 'form.errors.coverUrl'

  return errors
}

/**
 * Converts form values into API field values (empty text → `null`).
 *
 * @param values - Valid form values.
 */
function toFields(values: BookFormValues): Required<Omit<BookInput, 'pagesRead' | 'rating' | 'startedAt' | 'finishedAt'>> {
  const text = (value: string): string | null => (value.trim() === '' ? null : value.trim())
  return {
    title: values.title.trim(),
    author: values.author.trim(),
    isbn: text(values.isbn),
    publisher: text(values.publisher),
    publishedYear: parseOptionalInt(values.publishedYear),
    pageCount: parseOptionalInt(values.pageCount),
    coverUrl: text(values.coverUrl),
    tags: parseTags(values.tags),
    description: text(values.description),
    status: values.status,
  }
}

/**
 * Builds the body of `POST /api/books` (empty optional fields are omitted).
 *
 * @param values - Valid form values.
 */
export function formValuesToCreateInput(values: BookFormValues): BookInput {
  const input: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(toFields(values))) {
    if (value === null || (Array.isArray(value) && value.length === 0)) continue
    input[key] = value
  }
  return input as BookInput
}

/**
 * Builds the body of `PATCH /api/books/:id` with only the changed fields. The
 * reading status is not part of the edit form (it is changed on the details
 * page, where the reading rules apply).
 *
 * @param values - Valid form values.
 * @param original - Stored book.
 * @returns Changed fields (`null` clears a field); empty when nothing changed.
 */
export function formValuesToPatch(values: BookFormValues, original: Book): BookInput {
  const next = toFields(values)
  const previous = toFields(bookToFormValues(original))
  const patch: Record<string, unknown> = {}
  for (const key of Object.keys(next) as Array<keyof typeof next>) {
    if (key === 'status') continue
    if (JSON.stringify(next[key]) !== JSON.stringify(previous[key])) patch[key] = next[key]
  }
  return patch as BookInput
}
