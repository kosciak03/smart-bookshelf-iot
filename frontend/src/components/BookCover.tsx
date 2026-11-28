/**
 * @packageDocumentation
 * Book cover image with a typographic placeholder for books without a cover
 * (or when the image fails to load).
 */
import { useState } from 'react'
import { useI18n } from '../i18n/core'

/** Muted placeholder colours [background, text] (chosen by a hash of the title). */
const PLACEHOLDER_COLOURS: ReadonlyArray<readonly [string, string]> = [
  ['#23395B', '#E9EEF6'],
  ['#6B4E3D', '#F4EDE6'],
  ['#2E5E4E', '#E8F1EC'],
  ['#5B2A45', '#F6E9F0'],
  ['#9A4E2A', '#FFF3E8'],
  ['#1E4A5A', '#E4F2F6'],
  ['#3D3D52', '#ECECF4'],
]

/**
 * Picks a stable placeholder colour pair for a title.
 *
 * @param title - Book title.
 */
function placeholderColours(title: string): readonly [string, string] {
  let hash = 0
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return PLACEHOLDER_COLOURS[hash % PLACEHOLDER_COLOURS.length] ?? ['#3D3D52', '#ECECF4']
}

/** Props of {@link BookCover}. */
export interface BookCoverProps {
  title: string
  author?: string
  coverUrl: string | null
  /** Tailwind width class; the height follows the 2:3 aspect ratio. */
  className?: string
  /** Text size of the placeholder. */
  size?: 'xs' | 'sm' | 'lg'
}

/** Title / author text sizes of the placeholder. */
const PLACEHOLDER_TEXT = {
  xs: ['text-[9px]', 'hidden'],
  sm: ['text-[15px]', 'text-[11px]'],
  lg: ['text-[13px] md:text-2xl', 'text-[10px] md:text-sm'],
} as const

/**
 * Renders a 2:3 book cover.
 */
export function BookCover({ title, author, coverUrl, className = 'w-full', size = 'sm' }: BookCoverProps) {
  const { t } = useI18n()
  const [failed, setFailed] = useState(false)

  if (coverUrl !== null && !failed) {
    return (
      <img
        src={coverUrl}
        alt={t('book.coverOf', { title })}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${className} aspect-[2/3] rounded-[2px] object-cover shadow-[var(--sb-cover-shadow)]`}
      />
    )
  }

  const [background, foreground] = placeholderColours(title)
  const [titleSize, authorSize] = PLACEHOLDER_TEXT[size]
  return (
    <div
      className={`${className} flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-[2px] ${size === 'xs' ? 'p-1' : 'p-3'}`}
      style={{ backgroundColor: background, color: foreground }}
      role="img"
      aria-label={t('book.noCover', { title })}
    >
      <span className={`em line-clamp-4 leading-tight ${titleSize}`}>{title}</span>
      {author && <span className={`em line-clamp-2 opacity-85 ${authorSize}`}>{author}</span>}
    </div>
  )
}
