/**
 * @packageDocumentation
 * Reading statistics view (`/stats`). `?year=` selects the year of the
 * monthly breakdown.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { fetchStats } from '../api/stats'
import { BookCover } from '../components/BookCover'
import { ProgressBar } from '../components/BookBadges'
import { BarChart, ChartCard, ColumnChart, type ChartDatum } from '../components/charts'
import { EmptyState, ErrorMessage, Spinner } from '../components/Feedback'

/** Month names for axis labels and tooltips. */
const MONTHS = Array.from({ length: 12 }, (_, index) => new Date(Date.UTC(2026, index, 1)))

/**
 * A small number tile.
 *
 * @param props.label - Sentence-case label.
 * @param props.value - Displayed value.
 * @param props.to - Optional link to the matching library view.
 */
function StatTile({ label, value, to }: { label: string; value: string; to?: string }) {
  const body = (
    <>
      <div className="text-[15px] text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
    </>
  )
  const classes = 'block rounded-[var(--radius-ui)] border border-line bg-surface p-4 '
  return to ? (
    <Link to={to} className={`${classes} hover:border-accent`}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  )
}

/**
 * Renders the statistics page.
 */
export function StatsPage() {
  const [search, setSearch] = useSearchParams()
  const yearParam = Number(search.get('year'))
  const year = Number.isInteger(yearParam) && yearParam >= 1900 && yearParam <= 2100 ? yearParam : undefined

  const { data: stats, error, isPending } = useQuery({
    queryKey: ['stats', year ?? 'current'],
    queryFn: ({ signal }) => fetchStats(year, signal),
    placeholderData: keepPreviousData,
  })

  if (isPending) return <Spinner label="Loading statistics…" />
  if (error || !stats) return <ErrorMessage error={error} />

  if (stats.totals.books === 0) {
    return (
      <EmptyState title="No statistics yet">
        <Link to="/books/new" className="text-ink underline">
          Add your first book
        </Link>
      </EmptyState>
    )
  }

  const monthly: ChartDatum[] = stats.year.monthly.map((bucket) => {
    const date = MONTHS[bucket.month - 1] ?? new Date()
    return {
      label: date.toLocaleDateString('en-GB', { month: 'narrow', timeZone: 'UTC' }),
      fullLabel: `${date.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })} ${stats.year.year}`,
      value: bucket.books,
      detail: `${bucket.pages.toLocaleString('en-GB')} pages`,
    }
  })

  const ratings: ChartDatum[] = [...stats.ratings.distribution].reverse().map((bucket) => ({
    label: '★'.repeat(bucket.rating),
    fullLabel: `${bucket.rating} star${bucket.rating > 1 ? 's' : ''}`,
    value: bucket.count,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="em text-3xl">Reading statistics</h1>
        <label className="flex items-center gap-2 text-[15px]">
          <span className="text-muted">Year</span>
          <select
            value={stats.year.year}
            onChange={(event) => setSearch({ year: event.target.value })}
            className="rounded-[var(--radius-ui)] border border-line bg-surface px-2 py-1.5 text-[15px]"
          >
            {stats.year.availableYears.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Headline: the one hero number of the page. */}
      <section className="rounded-[var(--radius-ui)] border border-line bg-surface p-6 ">
        <p className="text-[15px] text-muted">Books finished in {stats.year.year}</p>
        <p className="text-5xl font-semibold text-ink">{stats.year.booksFinished}</p>
        <p className="mt-1 text-[15px] text-muted">{stats.year.pagesFinished.toLocaleString('en-GB')} pages in finished books</p>
      </section>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatTile label="Books in library" value={stats.totals.books.toLocaleString('en-GB')} to="/" />
        <StatTile label="Read" value={String(stats.totals.read)} to="/?status=READ" />
        <StatTile label="Currently reading" value={String(stats.totals.reading)} to="/?status=READING" />
        <StatTile label="Want to read" value={String(stats.totals.wantToRead)} to="/?status=WANT_TO_READ" />
        <StatTile
          label="Average rating"
          value={stats.ratings.average === null ? '–' : `${stats.ratings.average.toFixed(1)} ★`}
          to="/?sort=rating"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <ChartCard title="Books finished per month" subtitle={String(stats.year.year)} data={monthly} valueLabel="Books">
          <ColumnChart data={monthly} unit="books" />
        </ChartCard>
        <ChartCard
          title="Ratings"
          subtitle={`${stats.ratings.rated} rated ${stats.ratings.rated === 1 ? 'book' : 'books'}`}
          data={ratings}
          valueLabel="Books"
        >
          <BarChart data={ratings} unit="books" />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-[var(--radius-ui)] border border-line bg-surface p-5 ">
          <h2 className="mb-4 font-semibold text-ink">Currently reading</h2>
          {stats.currentlyReading.length === 0 ? (
            <p className="text-[15px] text-muted">Nothing in progress.</p>
          ) : (
            <ul className="space-y-4">
              {stats.currentlyReading.map((book) => (
                <li key={book.id} className="flex items-center gap-4">
                  <Link to={`/books/${book.id}`} className="w-10 shrink-0">
                    <BookCover title={book.title} coverUrl={book.coverUrl} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/books/${book.id}`} className="line-clamp-1 em text-[15px] hover:underline">
                      {book.title}
                    </Link>
                    <p className="line-clamp-1 text-[13px] text-muted">by {book.author}</p>
                    <ProgressBar pagesRead={book.pagesRead} pageCount={book.pageCount} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-5 rounded-[var(--radius-ui)] border border-line bg-surface p-5 ">
          <div>
            <h2 className="mb-2 font-semibold text-ink">On the smart shelf</h2>
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-[15px] tabular-nums">
              <dt className="text-muted">On the shelf</dt>
              <dd>{stats.totals.onShelf}</dd>
              <dt className="text-muted">Taken off the shelf</dt>
              <dd>{stats.totals.offShelf}</dd>
              <dt className="text-muted">No shelf slot</dt>
              <dd>{stats.totals.unassigned}</dd>
            </dl>
          </div>
          <div>
            <h2 className="mb-2 font-semibold text-ink">Top tags</h2>
            {stats.topTags.length === 0 ? (
              <p className="text-[15px] text-muted">No tags yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {stats.topTags.map(({ tag, count }) => (
                  <li key={tag}>
                    <Link
                      to={`/?tag=${encodeURIComponent(tag)}`}
                      className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[13px] text-ink hover:bg-raised"
                    >
                      {tag}
                      <span className="text-muted">{count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-[15px] text-muted">
            {stats.totals.pagesRead.toLocaleString('en-GB')} pages read in total (including books in progress).
          </p>
        </section>
      </div>
    </div>
  )
}
