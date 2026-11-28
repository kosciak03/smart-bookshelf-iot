/**
 * @packageDocumentation
 * Live smart shelf state: a cached query of `GET /api/shelf`, refreshed when
 * the backend announces a change over Server-Sent Events, plus the locate
 * actions (blink a book's or a slot's LED, switch it off).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { ApiError } from '../api/client'
import {
  fetchShelf,
  locateBook,
  locateSlot,
  SHELF_STREAM_URL,
  stopLocateSlot,
  type LocatedSlot,
  type ShelfSlot,
} from '../api/shelf'

/** Query key of the shelf state. */
export const SHELF_KEY = ['shelf'] as const

/**
 * Loads the shelf state. Without the SSE stream (e.g. a proxy that buffers
 * it) the state is still refreshed every 30 s.
 */
export function useShelf() {
  return useQuery({ queryKey: SHELF_KEY, queryFn: ({ signal }) => fetchShelf(signal), refetchInterval: 30_000 })
}

/**
 * Subscribes to `/api/shelf/stream` and refreshes the shelf, book lists and
 * statistics whenever the shelf reports a change (a book placed or taken, an
 * RFID scan, a light switching off). Mount once, in the layout.
 */
export function useShelfStream(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    const source = new EventSource(SHELF_STREAM_URL)
    const onChange = () => {
      void queryClient.invalidateQueries({ queryKey: SHELF_KEY })
      void queryClient.invalidateQueries({ queryKey: ['books'] })
      void queryClient.invalidateQueries({ queryKey: ['stats'] })
    }
    source.addEventListener('shelf', onChange)
    return () => source.close()
  }, [queryClient])
}

/** Refreshes the shelf state after a locate action. */
function useRefreshShelf() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: SHELF_KEY })
}

/** Blinks the slot of a book (`POST /api/books/:id/locate`). */
export function useLocateBook() {
  const onSuccess = useRefreshShelf()
  return useMutation<LocatedSlot, ApiError, string>({ mutationFn: locateBook, onSuccess })
}

/** Blinks a slot (`POST /api/shelf/slots/:id/locate`). */
export function useLocateSlot() {
  const onSuccess = useRefreshShelf()
  return useMutation<LocatedSlot, ApiError, string>({ mutationFn: locateSlot, onSuccess })
}

/** Switches a slot's blinking off (`DELETE /api/shelf/slots/:id/locate`). */
export function useStopLocate() {
  const onSuccess = useRefreshShelf()
  return useMutation<void, ApiError, string>({ mutationFn: stopLocateSlot, onSuccess })
}

/**
 * Current time, re-rendered every second while `active` (for countdowns).
 *
 * @param active - Whether a countdown is visible.
 */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

/**
 * Seconds until a highlight switches itself off.
 *
 * @param slot - Slot (or `undefined`).
 * @param now - Current time (ms).
 * @returns Whole seconds left, or `null` when the slot is not blinking for LOCATE.
 */
export function locateSecondsLeft(slot: ShelfSlot | undefined, now: number): number | null {
  if (!slot || slot.highlight !== 'LOCATE' || slot.highlightUntil === null) return null
  return Math.max(0, Math.ceil((Date.parse(slot.highlightUntil) - now) / 1000))
}
