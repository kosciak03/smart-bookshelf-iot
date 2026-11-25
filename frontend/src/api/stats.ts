/**
 * @packageDocumentation
 * Reading statistics endpoint (`GET /api/stats`). Types mirror the backend.
 */
import { apiRequest } from './client'

/** Books finished in one calendar month. */
export interface MonthBucket {
  /** Month 1–12. */
  month: number
  books: number
  pages: number
}

/** A book being read, with its progress. */
export interface CurrentlyReadingBook {
  id: string
  title: string
  author: string
  coverUrl: string | null
  pagesRead: number
  pageCount: number | null
  startedAt: string | null
}

/** Body of `GET /api/stats`. */
export interface LibraryStats {
  totals: {
    books: number
    wantToRead: number
    reading: number
    read: number
    onShelf: number
    offShelf: number
    unassigned: number
    pagesRead: number
  }
  ratings: {
    average: number | null
    rated: number
    distribution: Array<{ rating: number; count: number }>
  }
  year: {
    year: number
    booksFinished: number
    pagesFinished: number
    monthly: MonthBucket[]
    availableYears: number[]
  }
  currentlyReading: CurrentlyReadingBook[]
  topTags: Array<{ tag: string; count: number }>
}

/**
 * Fetches the reading statistics.
 *
 * @param year - Year of the monthly breakdown (`undefined` = current year).
 * @param signal - Abort signal.
 */
export async function fetchStats(year?: number, signal?: AbortSignal): Promise<LibraryStats> {
  const response = await apiRequest<{ data: LibraryStats }>('/stats', {
    query: { year },
    ...(signal ? { signal } : {}),
  })
  return response.data
}
