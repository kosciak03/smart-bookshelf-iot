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
import { useI18n, type I18n } from '../i18n/core'
import { BookCover } from './BookCover'
import { errorMessage } from './Feedback'

/**
 * Text describing a slot's state.
 *
 * @param slot - Slot.
 * @param secondsLeft - Countdown of a LOCATE light, if blinking.
 * @param t - Translation function.
 */
export function slotStateText(slot: ShelfSlot, secondsLeft: number | null, t: I18n['t']): string {
  switch (slot.highlight) {
    case 'LOCATE':
      return secondsLeft === null ? t('shelf.stateBlinkingShort') : t('shelf.stateBlinking', { seconds: secondsLeft })
    case 'PUT_BACK':
      return t('shelf.statePutBack')
    case 'MISPLACED':
      return t('shelf.stateWrong')
    case 'CONFIRMED':
      return t('shelf.stateConfirmed')
    default:
      if (slot.isOccupied) return slot.book ? t('shelf.stateOnShelf') : t('shelf.stateSomething')
      return slot.book ? t('shelf.stateTaken') : t('shelf.free')
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
  error: unknown
}

/**
 * Presentational part of {@link ShelfStrip}.
 */
function ShelfStripView({ shelf, now, onToggle, error }: ShelfStripViewProps) {
  const i18n = useI18n()
  const { t } = i18n
  const slots = [...shelf.slots].sort((a, b) => a.slotNumber - b.slotNumber)
  const occupied = slots.filter((slot) => slot.isOccupied).length
  const blinking = slots.filter((slot) => slot.highlight === 'LOCATE')
  // Grid columns: wall | slot | wall | … | slot | wall.
  const columns = `0.5rem repeat(${slots.length}, minmax(0, 1fr) 0.5rem)`

  return (
    <section aria-label={t('shelf.region')} className="space-y-3 rounded-[var(--radius-ui)] border border-line bg-surface p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2.5">
          <h2 className="em text-lg">{t('shelf.title')}</h2>
          <span className="text-[13px] text-muted">
            {shelf.device.online ? t('shelf.online') : t('shelf.offline')} · {t('shelf.occupied', { occupied, total: slots.length })}
          </span>
        </div>
        <ul className="hidden gap-3.5 text-[13px] text-muted sm:flex" aria-label={t('shelf.legend')}>
          <li className="flex items-center gap-1.5"><span className="h-1 w-2.5 rounded-full bg-locate" aria-hidden="true" />{t('shelf.legendFind')}</li>
          <li className="flex items-center gap-1.5"><span className="h-1 w-2.5 rounded-full bg-putback" aria-hidden="true" />{t('shelf.legendPutBack')}</li>
          <li className="flex items-center gap-1.5"><span className="h-1 w-2.5 rounded-full bg-misplaced" aria-hidden="true" />{t('shelf.legendWrong')}</li>
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
                  ? t('shelf.blinkingAria', { number: slot.slotNumber })
                  : t('shelf.blinkAria', { number: slot.slotNumber, title: slot.book?.title ?? t('shelf.free') })
              }
              title={slot.book?.title ?? t('shelf.free')}
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
                  <span className="md:hidden">{t('shelf.slotShort', { number: slot.slotNumber })}</span>
                  <span className="hidden md:inline">{t('shelf.slotCode', { number: String(slot.slotNumber).padStart(2, '0') })}</span>
                </span>
                <span className="em hidden truncate text-[14px] md:block">{slot.book?.title ?? t('shelf.free')}</span>
                <span className={`hidden truncate text-[13px] md:block ${isLocate ? 'font-bold' : 'text-muted'}`}>{slotStateText(slot, secondsLeft, t)}</span>
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
              {t('shelf.blinkingList', {
                list: blinking
                  .map(
                    (slot) =>
                      `${t('shelf.slotShort', { number: slot.slotNumber })}${slot.book ? ` ${slot.book.title}` : ''} · ${locateSecondsLeft(slot, now) ?? 0} s`,
                  )
                  .join(', '),
              })}
            </span>
            {blinking.length === 1 && blinking[0]?.book && (
              <Link to={`/books/${blinking[0].book.id}`} className="text-ink underline underline-offset-2">
                {t('shelf.openBook')}
              </Link>
            )}
            <button
              type="button"
              onClick={() => blinking.forEach((slot) => onToggle(slot))}
              className="h-9 rounded-[var(--radius-ui)] border border-line px-3 hover:bg-raised"
            >
              {t('shelf.turnOff')}
            </button>
          </>
        ) : (
          <span className="text-muted">{t('shelf.hint')}</span>
        )}
      </div>
      {!shelf.device.online && (
        <p className="text-[13px] text-warn">{t('shelf.offlineNote')}</p>
      )}
      {error != null && (
        <p className="text-[13px] text-danger" role="alert">
          {errorMessage(error, i18n)}
        </p>
      )}
    </section>
  )
}
