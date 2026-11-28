/**
 * @packageDocumentation
 * Smart shelf endpoints (`/api/shelf`, shelf actions on books). Types mirror
 * the backend (`backend/src/modules/shelf/shelf.service.ts`).
 */
import type { LocationStatus } from './books'
import { apiRequest } from './client'

/** Why a slot's LED is lit. */
export type HighlightReason = 'LOCATE' | 'PUT_BACK' | 'MISPLACED' | 'CONFIRMED'

/** One slot of the shelf. */
export interface ShelfSlot {
  id: string
  slotNumber: number
  fsrChannel: number
  ledStartIdx: number
  ledEndIdx: number
  /** The pressure sensor reports something standing in the slot. */
  isOccupied: boolean
  isHighlighted: boolean
  /** Strongest active LED state, `null` when the slot is dark. */
  highlight: HighlightReason | null
  /** ISO time when the highlight switches itself off. */
  highlightUntil: string | null
  /** Book assigned to the slot. */
  book: { id: string; title: string; author: string; coverUrl: string | null; locationStatus: LocationStatus } | null
}

/** One LED of the strip. */
export interface LedPixel {
  color: string
  effect: 'solid' | 'blink'
}

/** State of one shelf (`GET /api/shelf`). */
export interface ShelfState {
  shelfNumber: number
  device: { online: boolean; lastSeen: string | null; firmware?: string; ip?: string; rssi?: number }
  broker: { connected: boolean }
  slots: ShelfSlot[]
  leds: { version: 1; pixels: LedPixel[] }
  pendingTag: { uid: string; shelfNumber: number; scannedAt: string } | null
  expected: { bookId: string; slotId: string; until: string } | null
}

/** A slot lit by a locate request. */
export interface LocatedSlot {
  id: string
  shelfNumber: number
  slotNumber: number
  /** ISO time when the light switches itself off. */
  until: string
}

/**
 * Fetches the state of shelf 1.
 *
 * @param signal - Abort signal.
 */
export async function fetchShelf(signal?: AbortSignal): Promise<ShelfState> {
  return (await apiRequest<{ data: ShelfState }>('/shelf', signal ? { signal } : {})).data
}

/**
 * Blinks the slot of a book.
 *
 * @param bookId - Book id.
 * @returns The lit slot.
 */
export async function locateBook(bookId: string): Promise<LocatedSlot> {
  return (await apiRequest<{ data: { slot: LocatedSlot } }>(`/books/${bookId}/locate`, { method: 'POST' })).data.slot
}

/**
 * Blinks a slot (also an empty one).
 *
 * @param slotId - Slot id.
 * @returns The lit slot.
 */
export async function locateSlot(slotId: string): Promise<LocatedSlot> {
  return (await apiRequest<{ data: { slot: LocatedSlot } }>(`/shelf/slots/${slotId}/locate`, { method: 'POST' })).data.slot
}

/**
 * Switches a slot's blinking off early.
 *
 * @param slotId - Slot id.
 */
export async function stopLocateSlot(slotId: string): Promise<void> {
  await apiRequest<void>(`/shelf/slots/${slotId}/locate`, { method: 'DELETE' })
}

/** URL of the Server-Sent Events stream with shelf change notifications. */
export const SHELF_STREAM_URL = '/api/shelf/stream'
