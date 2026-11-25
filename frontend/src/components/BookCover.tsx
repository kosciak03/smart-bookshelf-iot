/**
 * @packageDocumentation
 * Book cover image with a generated placeholder for books without a cover
 * (or when the image fails to load).
 */
import { useState } from 'react'

/** Background colours of placeholder covers (chosen by a hash of the title). */
const PLACEHOLDER_COLOURS = ['bg-amber-800', 'bg-emerald-800', 'bg-sky-800', 'bg-rose-800', 'bg-indigo-800', 'bg-stone-700']

/**
 * Picks a stable placeholder colour for a title.
 *
 * @param title - Book title.
 */
function placeholderColour(title: string): string {
  let hash = 0
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return PLACEHOLDER_COLOURS[hash % PLACEHOLDER_COLOURS.length] ?? 'bg-stone-700'
}

/** Props of {@link BookCover}. */
export interface BookCoverProps {
  title: string
  author?: string
  coverUrl: string | null
  /** Tailwind width class; the height follows the 2:3 aspect ratio. */
  className?: string
}

/**
 * Renders a 2:3 book cover.
 */
export function BookCover({ title, author, coverUrl, className = 'w-full' }: BookCoverProps) {
  const [failed, setFailed] = useState(false)

  if (coverUrl !== null && !failed) {
    return (
      <img
        src={coverUrl}
        alt={`Cover of ${title}`}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${className} aspect-[2/3] rounded object-cover shadow-md`}
      />
    )
  }

  return (
    <div
      className={`${className} ${placeholderColour(title)} flex aspect-[2/3] flex-col justify-between rounded p-3 text-white shadow-md`}
      role="img"
      aria-label={`No cover for ${title}`}
    >
      <span className="line-clamp-4 font-serif text-sm font-bold leading-snug">{title}</span>
      {author && <span className="line-clamp-2 text-xs opacity-80">{author}</span>}
    </div>
  )
}
