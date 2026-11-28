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
import { useI18n } from '../i18n/core'

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
  const { t, locale, formatNumber } = useI18n()
  const [search, setSearch] = useSearchParams()
  const yearParam = Number(search.get('year'))
  const year = Number.isInteger(yearParam) && yearParam >= 1900 && yearParam <= 2100 ? yearParam : undefined

  const { data: stats, error, isPending } = useQuery({
    queryKey: ['stats', year ?? 'current'],
    queryFn: ({ signal }) => fetchStats(year, signal),
    placeholderData: keepPreviousData,
  })

  if (isPending) return <Spinner label={t('stats.loading')} />
  if (error || !stats) return <ErrorMessage error={error} />

  if (stats.totals.books === 0) {
    return (
      <EmptyState title={t('stats.empty')}>
        <Link to="/books/new" className="text-ink underline">
          {t('stats.addFirst')}
        </Link>
      </EmptyState>
    )
  }

  const monthly: ChartDatum[] = stats.year.monthly.map((bucket) => {
    const date = MONTHS[bucket.month - 1] ?? new Date()
    return {
      label: date.toLocaleDateString(locale, { month: 'narrow', timeZone: 'UTC' }),
      fullLabel: `${date.toLocaleDateString(locale, { month: 'long', timeZone: 'UTC' })} ${stats.year.year}`,
      value: bucket.books,
      detail: t('stats.pagesDetail', { count: bucket.pages }),
    }
  })

  const ratings: ChartDatum[] = [...stats.ratings.distribution].reverse().map((bucket) => ({
    label: '★'.repeat(bucket.rating),
    fullLabel: t('stats.starsLabel', { count: bucket.rating }),
    value: bucket.count,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="em text-3xl">{t('stats.title')}</h1>
        <label className="flex items-center gap-2 text-[15px]">
          <span className="text-muted">{t('stats.year')}</span>
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
        <p className="text-[15px] text-muted">{t('stats.finishedIn', { year: String(stats.year.year) })}</p>
        <p className="text-5xl font-semibold text-ink">{stats.year.booksFinished}</p>
        <p className="mt-1 text-[15px] text-muted">{t('stats.pagesFinished', { count: stats.year.pagesFinished })}</p>
      </section>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatTile label={t('stats.tileBooks')} value={formatNumber(stats.totals.books)} to="/" />
        <StatTile label={t('stats.tileRead')} value={String(stats.totals.read)} to="/?status=READ" />
        <StatTile label={t('stats.tileReading')} value={String(stats.totals.reading)} to="/?status=READING" />
        <StatTile label={t('stats.tileWant')} value={String(stats.totals.wantToRead)} to="/?status=WANT_TO_READ" />
        <StatTile
          label={t('stats.tileAverage')}
          value={stats.ratings.average === null ? '–' : `${stats.ratings.average.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ★`}
          to="/?sort=rating"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <ChartCard title={t('stats.perMonth')} subtitle={String(stats.year.year)} data={monthly} valueLabel={t('stats.books')}>
          <ColumnChart data={monthly} label={t('stats.perMonth')} formatValue={(count) => t('stats.booksCount', { count })} />
        </ChartCard>
        <ChartCard
          title={t('stats.ratings')}
          subtitle={t('stats.rated', { count: stats.ratings.rated })}
          data={ratings}
          valueLabel="Books"
        >
          <BarChart data={ratings} label={t('stats.ratings')} formatValue={(count) => t('stats.booksCount', { count })} />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-[var(--radius-ui)] border border-line bg-surface p-5 ">
          <h2 className="mb-4 font-semibold text-ink">{t('stats.reading')}</h2>
          {stats.currentlyReading.length === 0 ? (
            <p className="text-[15px] text-muted">{t('stats.nothingReading')}</p>
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
                    <p className="em line-clamp-1 text-[13px] text-muted">{book.author}</p>
                    <ProgressBar pagesRead={book.pagesRead} pageCount={book.pageCount} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-5 rounded-[var(--radius-ui)] border border-line bg-surface p-5 ">
          <div>
            <h2 className="mb-2 font-semibold text-ink">{t('stats.smartShelf')}</h2>
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-[15px] tabular-nums">
              <dt className="text-muted">{t('stats.onShelf')}</dt>
              <dd>{stats.totals.onShelf}</dd>
              <dt className="text-muted">{t('stats.takenOff')}</dt>
              <dd>{stats.totals.offShelf}</dd>
              <dt className="text-muted">{t('stats.noSlot')}</dt>
              <dd>{stats.totals.unassigned}</dd>
            </dl>
          </div>
          <div>
            <h2 className="mb-2 font-semibold text-ink">{t('stats.topTags')}</h2>
            {stats.topTags.length === 0 ? (
              <p className="text-[15px] text-muted">{t('stats.noTags')}</p>
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
            {t('stats.pagesTotal', { count: stats.totals.pagesRead })}
          </p>
        </section>
      </div>
    </div>
  )
}
