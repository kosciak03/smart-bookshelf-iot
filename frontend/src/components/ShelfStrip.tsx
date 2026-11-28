/**
 * @packageDocumentation
 * Live view of the physical shelf on top of the library: the LED strip
 * (wall – slot – wall …, as on the prototype PCB) and one tile per slot.
 * Clicking a slot makes its LED blink blue; clicking again switches it off.
 * The light also goes out by itself after the backend timeout or when the
 * book is taken off the shelf.
 */
import { Link } from 'react-router'
import type { LedPixel, ShelfSlot, ShelfState } from '../api/shelf'
import { locateSecondsLeft, useLocateSlot, useNow, useShelf, useStopLocate } from '../hooks/useShelf'
import { BookCover } from './BookCover'

/**
 * Text describing a slot's state.
 *
 * @param slot - Slot.
 * @param secondsLeft - Countdown of a LOCATE light, if blinking.
 */
export function slotStateText(slot: ShelfSlot, secondsLeft: number | null): string {
  switch (slot.highlight) {
    case 'LOCATE':
      return secondsLeft === null ? 'Blinking' : `Blinking · ${secondsLeft} s`
    case 'PUT_BACK':
      return 'Put the book here'
    case 'MISPLACED':
      return 'Wrong book here'
    case 'CONFIRMED':
      return 'Placed correctly'
    default:
      if (slot.isOccupied) return slot.book ? 'On the shelf' : 'Something is here'
      return slot.book ? 'Taken off the shelf' : 'Free slot'
  }
}

/** Border colour of a slot tile per highlight. */
const HIGHLIGHT_BORDERS: Record<NonNullable<ShelfSlot['highlight']>, string> = {
  LOCATE: 'border-locate',
  PUT_BACK: 'border-putback',
  MISPLACED: 'border-misplaced',
  CONFIRMED: 'border-putback',
}

/**
 * One LED of the strip.
 *
 * @param props.pixel - LED colour and effect.
 * @param props.isWall - Whether this LED separates slots.
 */
function Led({ pixel, isWall }: { pixel: LedPixel | undefined; isWall: boolean }) {
  const off = !pixel || pixel.color.toUpperCase() === '#000000'
  if (off) return <span className={`h-1.5 rounded-full border ${isWall ? 'border-line' : 'border-dashed border-track'}`} aria-hidden="true" />
  return (
    <span
      className={`h-1.5 rounded-full ${isWall ? 'border border-line' : ''} ${pixel.effect === 'blink' ? 'animate-led-blink' : ''}`}
      style={{ backgroundColor: pixel.color }}
      aria-hidden="true"
    />
  )
}

/**
 * Renders the shelf strip (nothing when the shelf has no slots configured).
 */
export function ShelfStrip() {
  const { data: shelf } = useShelf()
  const anyBlinking = shelf?.slots.some((slot) => slot.highlight === 'LOCATE') ?? false
  const now = useNow(anyBlinking)
  const locate = useLocateSlot()
  const stop = useStopLocate()

  if (!shelf || shelf.slots.length === 0) return null
  return <ShelfStripView shelf={shelf} now={now} onToggle={(slot) => (slot.highlight === 'LOCATE' ? stop.mutate(slot.id) : locate.mutate(slot.id))} error={locate.error ?? stop.error} />
}

/** Props of {@link ShelfStripView}. */
interface ShelfStripViewProps {
  shelf: ShelfState
  now: number
  onToggle: (slot: ShelfSlot) => void
  error: Error | null
}

/**
 * Presentational part of {@link ShelfStrip}.
 */
function ShelfStripView({ shelf, now, onToggle, error }: ShelfStripViewProps) {
  const slots = [...shelf.slots].sort((a, b) => a.slotNumber - b.slotNumber)
  const occupied = slots.filter((slot) => slot.isOccupied).length
  const blinking = slots.filter((slot) => slot.highlight === 'LOCATE')
  // Grid columns: wall | slot | wall | … | slot | wall.
  const columns = `0.5rem repeat(${slots.length}, minmax(0, 1fr) 0.5rem)`

  return (
    <section aria-label="Shelf 1 – live" className="space-y-3 rounded-[var(--radius-ui)] border border-line bg-surface p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2.5">
          <h2 className="em text-lg">Shelf 1</h2>
          <span className="text-[13px] text-muted">
            {shelf.device.online ? 'online' : 'offline'} · {occupied}/{slots.length} occupied
          </span>
        </div>
        <ul className="hidden gap-3.5 text-[13px] text-muted sm:flex" aria-label="LED colours">
          <li className="flex items-center gap-1.5"><span className="h-1 w-2.5 rounded-full bg-locate" aria-hidden="true" />Find</li>
          <li className="flex items-center gap-1.5"><span className="h-1 w-2.5 rounded-full bg-putback" aria-hidden="true" />Put back here</li>
          <li className="flex items-center gap-1.5"><span className="h-1 w-2.5 rounded-full bg-misplaced" aria-hidden="true" />Wrong slot</li>
        </ul>
      </div>

      <div className="grid gap-x-1.5 gap-y-2 sm:gap-x-2" style={{ gridTemplateColumns: columns }}>
        {shelf.leds.pixels.slice(0, slots.length * 2 + 1).map((pixel, index) => (
          <Led key={`led-${index}`} pixel={pixel} isWall={index % 2 === 0} />
        ))}
        {slots.map((slot, index) => {
          const secondsLeft = locateSecondsLeft(slot, now)
          const isLocate = slot.highlight === 'LOCATE'
          const border = slot.highlight ? HIGHLIGHT_BORDERS[slot.highlight] : slot.isOccupied || slot.book ? 'border-line' : 'border-dashed border-line'
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => onToggle(slot)}
              aria-pressed={isLocate}
              aria-label={
                isLocate
                  ? `Slot ${slot.slotNumber} is blinking – turn off`
                  : `Make slot ${slot.slotNumber} blink${slot.book ? ` (${slot.book.title})` : ' (free slot)'}`
              }
              title={slot.book?.title ?? 'Free slot'}
              className={`flex min-h-11 min-w-0 items-center justify-center gap-2.5 rounded-[var(--radius-ui)] border-2 p-1.5 text-left transition-colors md:justify-start md:p-2 ${border} ${
                isLocate ? 'bg-locate-soft text-locate-ink' : slot.isOccupied ? 'bg-raised hover:bg-accent-soft' : 'hover:bg-raised'
              }`}
              style={{ gridColumn: index * 2 + 2, gridRow: 2 }}
            >
              <span className="hidden w-8 shrink-0 md:block">
                {slot.book && slot.isOccupied ? (
                  <BookCover title={slot.book.title} coverUrl={slot.book.coverUrl} className="w-8" size="xs" />
                ) : (
                  <span className="block aspect-[2/3] w-8 rounded-[2px] border border-dashed border-track" />
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[12px] font-medium tracking-wide text-muted md:text-[11px]">
                  <span className="md:hidden">S{slot.slotNumber}</span>
                  <span className="hidden md:inline">SLOT {String(slot.slotNumber).padStart(2, '0')}</span>
                </span>
                <span className="em hidden truncate text-[14px] md:block">{slot.book?.title ?? 'Free slot'}</span>
                <span className={`hidden truncate text-[13px] md:block ${isLocate ? 'font-bold' : 'text-muted'}`}>{slotStateText(slot, secondsLeft)}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]" role="status" aria-live="polite">
        {blinking.length > 0 ? (
          <>
            <span className="h-2 w-2 rounded-full bg-locate animate-led-blink" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">
              Blinking:{' '}
              {blinking
                .map((slot) => `S${slot.slotNumber}${slot.book ? ` ${slot.book.title}` : ''} · ${locateSecondsLeft(slot, now) ?? 0} s`)
                .join(', ')}
            </span>
            {blinking.length === 1 && blinking[0]?.book && (
              <Link to={`/books/${blinking[0].book.id}`} className="text-ink underline underline-offset-2">
                Open book
              </Link>
            )}
            <button
              type="button"
              onClick={() => blinking.forEach((slot) => onToggle(slot))}
              className="h-9 rounded-[var(--radius-ui)] border border-line px-3 hover:bg-raised"
            >
              Turn off
            </button>
          </>
        ) : (
          <span className="text-muted">Click a slot to make its LED blink. It turns off by itself after a few seconds or when the book is taken off.</span>
        )}
      </div>
      {!shelf.device.online && (
        <p className="text-[13px] text-warn">The shelf is offline – the LEDs will update when it reconnects.</p>
      )}
      {error && (
        <p className="text-[13px] text-danger" role="alert">
          {error.message}
        </p>
      )}
    </section>
  )
}
