/**
 * @packageDocumentation
 * "Find on shelf" button: blinks the LED of a book's slot blue. While the slot
 * blinks it shows a countdown and a second click switches it off early. The
 * light also goes out by itself after the backend timeout or as soon as the
 * book is taken off the shelf.
 */
import { LocateFixed } from 'lucide-react'
import type { ShelfSlot } from '../api/shelf'
import { locateSecondsLeft, useLocateBook, useNow, useShelf, useStopLocate } from '../hooks/useShelf'

/** Props of {@link LocateButton}. */
export interface LocateButtonProps {
  bookId: string
  /** Id of the book's slot. */
  slotId: string
  /** `card`: compact, for the library grid; `panel`: full width, on the book page. */
  variant?: 'card' | 'panel'
}

/**
 * Finds the live state of a slot.
 *
 * @param slots - Slots of the shelf state.
 * @param slotId - Slot id.
 */
export function findSlot(slots: ShelfSlot[] | undefined, slotId: string): ShelfSlot | undefined {
  return slots?.find((slot) => slot.id === slotId)
}

/**
 * Renders the button.
 */
export function LocateButton({ bookId, slotId, variant = 'card' }: LocateButtonProps) {
  const { data: shelf } = useShelf()
  const slot = findSlot(shelf?.slots, slotId)
  const blinking = slot?.highlight === 'LOCATE'
  const now = useNow(blinking)
  const secondsLeft = locateSecondsLeft(slot, now)
  const locate = useLocateBook()
  const stop = useStopLocate()
  const busy = locate.isPending || stop.isPending

  const size = variant === 'card' ? 'h-9 text-[13px]' : 'h-11 w-full text-[15px]'
  const look = blinking
    ? 'border-locate bg-locate-soft text-locate-ink'
    : variant === 'panel'
      ? 'border-accent bg-accent text-on-accent hover:bg-accent-hover'
      : 'border-line bg-transparent text-ink hover:bg-raised'

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => (blinking ? stop.mutate(slotId) : locate.mutate(bookId))}
        aria-pressed={blinking}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-ui)] border px-3 font-medium transition-colors disabled:opacity-60 ${size} ${look}`}
      >
        {blinking ? (
          <span className="h-2 w-2 rounded-full bg-locate animate-led-blink" aria-hidden="true" />
        ) : (
          <LocateFixed className="h-4 w-4" aria-hidden="true" />
        )}
        {blinking ? `Blinking${secondsLeft !== null ? ` · ${secondsLeft} s` : ''} – turn off` : 'Find on shelf'}
      </button>
      {(locate.error || stop.error) && (
        <p className="text-[13px] text-danger" role="alert">
          {(locate.error ?? stop.error)?.message}
        </p>
      )}
    </div>
  )
}
