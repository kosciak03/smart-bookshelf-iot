/**
 * @packageDocumentation
 * Five-star rating: read-only display or interactive input.
 */
import { Star } from 'lucide-react'
import { useState } from 'react'

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
  const [hovered, setHovered] = useState<number | null>(null)
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'
  const shown = hovered ?? value ?? 0

  if (onChange === undefined) {
    if (value === null) return <span className="text-xs text-stone-400">Not rated</span>
    return (
      <span className="inline-flex" role="img" aria-label={`Rated ${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            aria-hidden="true"
            className={`${iconSize} ${star <= value ? 'fill-star text-star' : 'text-stone-300'}`}
          />
        ))}
      </span>
    )
  }

  return (
    <span className="inline-flex" role="group" aria-label="Rating" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          aria-pressed={value === star}
          title={value === star ? 'Click again to clear the rating' : `Rate ${star} of 5`}
          onMouseEnter={() => setHovered(star)}
          onClick={() => onChange(value === star ? null : star)}
          className="p-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Star
            aria-hidden="true"
            className={`${iconSize} transition-colors ${star <= shown ? 'fill-star text-star' : 'text-stone-300'}`}
          />
        </button>
      ))}
    </span>
  )
}
