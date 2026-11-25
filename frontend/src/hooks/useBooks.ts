/**
 * @packageDocumentation
 * TanStack Query hooks for the book catalogue. Queries are cached by key and
 * every successful mutation invalidates the cached book lists and details.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createBook,
  deleteBook,
  getBook,
  importBook,
  listBooks,
  lookupIsbn,
  updateBook,
  type Book,
  type BookInput,
  type ListBooksParams,
} from '../api/books'
import type { ApiError } from '../api/client'

/** Query keys used for caching. */
export const bookKeys = {
  all: ['books'] as const,
  list: (params: ListBooksParams) => ['books', 'list', params] as const,
  detail: (id: string) => ['books', 'detail', id] as const,
  isbn: (isbn: string) => ['isbn', isbn] as const,
}

/**
 * Loads a page of books. The previous page stays visible while the next one
 * loads, so changing a filter does not make the grid flicker.
 *
 * @param params - Search, filters, sorting and pagination.
 */
export function useBookList(params: ListBooksParams) {
  return useQuery({
    queryKey: bookKeys.list(params),
    queryFn: ({ signal }) => listBooks(params, signal),
    placeholderData: keepPreviousData,
  })
}

/**
 * Loads a single book.
 *
 * @param id - Book id.
 */
export function useBook(id: string) {
  return useQuery({ queryKey: bookKeys.detail(id), queryFn: ({ signal }) => getBook(id, signal) })
}

/**
 * Looks up ISBN metadata. Disabled until an ISBN is given.
 *
 * @param isbn - ISBN to look up, or `null` for no lookup.
 */
export function useIsbnLookup(isbn: string | null) {
  return useQuery<Awaited<ReturnType<typeof lookupIsbn>>, ApiError>({
    queryKey: bookKeys.isbn(isbn ?? ''),
    queryFn: ({ signal }) => lookupIsbn(isbn ?? '', signal),
    enabled: isbn !== null,
    retry: false,
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * Returns a callback that stores a book in the cache and invalidates the lists.
 */
function useBookCacheUpdater() {
  const queryClient = useQueryClient()
  return (book: Book) => {
    queryClient.setQueryData(bookKeys.detail(book.id), book)
    return queryClient.invalidateQueries({ queryKey: ['books', 'list'] })
  }
}

/** Creates a book from manually entered data. */
export function useCreateBook() {
  const onSuccess = useBookCacheUpdater()
  return useMutation<Book, ApiError, BookInput>({ mutationFn: createBook, onSuccess })
}

/** Imports a book by ISBN. */
export function useImportBook() {
  const onSuccess = useBookCacheUpdater()
  return useMutation<Book, ApiError, BookInput & { isbn: string }>({ mutationFn: importBook, onSuccess })
}

/**
 * Updates a book.
 *
 * @param id - Book id.
 */
export function useUpdateBook(id: string) {
  const onSuccess = useBookCacheUpdater()
  return useMutation<Book, ApiError, BookInput>({ mutationFn: (patch) => updateBook(id, patch), onSuccess })
}

/** Deletes a book. */
export function useDeleteBook() {
  const queryClient = useQueryClient()
  return useMutation<void, ApiError, string>({
    mutationFn: deleteBook,
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: bookKeys.detail(id) })
      return queryClient.invalidateQueries({ queryKey: ['books', 'list'] })
    },
  })
}
