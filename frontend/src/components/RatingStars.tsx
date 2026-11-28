/**
 * @packageDocumentation
 * Five-star rating: read-only display or interactive input. Stars use the
 * ink colour (no extra accent colour).
 */
import { Star } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../i18n/core'

/** Props of {@link RatingStars}. */
export interface RatingStarsProps {
  /** Current rating 1–5, or `null` when not rated. */
  value: number | null
  /**
   * Called with the new rating. Clicking the current rating clears it
   * (`null`). Without this callback the stars are read-only.
   */
  onChange?: (rating: number | null) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

/**
 * Renders five stars.
 */
export function RatingStars({ value, onChange, disabled = false, size = 'sm' }: RatingStarsProps) {
  const { t } = useI18n()
  const [hovered, setHovered] = useState<number | null>(null)
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-6 w-6'
  const shown = hovered ?? value ?? 0

  if (onChange === undefined) {
    if (value === null) return <span className="text-[13px] text-muted">{t('common.notRated')}</span>
    return (
      <span className="inline-flex gap-px" role="img" aria-label={t('book.rated', { value })}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            aria-hidden="true"
            className={`${iconSize} ${star <= value ? 'fill-ink text-ink' : 'text-track'}`}
            strokeWidth={1.6}
          />
        ))}
      </span>
    )
  }

  return (
    <span className="inline-flex" role="group" aria-label={t('book.ratingGroup')} onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          aria-label={t('book.stars', { count: star })}
          aria-pressed={value === star}
          title={value === star ? t('book.clearRating') : t('book.rate', { value: star })}
          onMouseEnter={() => setHovered(star)}
          onClick={() => onChange(value === star ? null : star)}
          className="flex h-11 w-9 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Star
            aria-hidden="true"
            strokeWidth={1.6}
            className={`${iconSize} transition-colors ${star <= shown ? 'fill-ink text-ink' : 'text-track'}`}
          />
        </button>
      ))}
    </span>
  )
}
