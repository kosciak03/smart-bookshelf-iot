/**
 * @packageDocumentation
 * Small single-series charts for the statistics page, built from plain HTML
 * (no chart library).
 *
 * Conventions: one series in the leaf colour, so no legend box (the card title
 * names the series); thin marks (≤ 24 px columns, 4 px rounded data end,
 * square at the baseline); hairline gridlines; a tooltip on hover and keyboard
 * focus; every chart can be switched to a table view.
 */
import { useState, type ReactNode } from 'react'

/** A single value of a chart. */
export interface ChartDatum {
  /** Short axis label, e.g. `Mar`. */
  label: string
  /** Full label for tooltips and the table, e.g. `March 2026`. */
  fullLabel: string
  value: number
  /** Optional extra tooltip line, e.g. `500 pages`. */
  detail?: string
}

/**
 * Computes "nice" axis ticks from 0 to at least `max`.
 *
 * @param max - Largest value.
 * @returns Ascending integer ticks (at most 5), always starting at 0.
 */
export function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1]
  const rawStep = max / 4
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = Math.max(1, [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rawStep) ?? magnitude * 10)
  const ticks: number[] = []
  for (let tick = 0; tick < max + step; tick += step) ticks.push(tick)
  return ticks
}

/**
 * Card wrapper with a title and a chart/table switch.
 *
 * @param props.title - Card title (names the plotted series).
 * @param props.subtitle - Optional one-line summary.
 * @param props.data - Values, used for the table view.
 * @param props.valueLabel - Column header of the values in the table view.
 * @param props.children - The chart.
 */
export function ChartCard({
  title,
  subtitle,
  data,
  valueLabel,
  children,
}: {
  title: string
  subtitle?: ReactNode
  data: ChartDatum[]
  valueLabel: string
  children: ReactNode
}) {
  const [asTable, setAsTable] = useState(false)
  return (
    <section className="rounded-[var(--radius-ui)] border border-line bg-surface p-5 ">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">{title}</h2>
          {subtitle && <p className="text-[15px] text-muted">{subtitle}</p>}
        </div>
        <button type="button" onClick={() => setAsTable(!asTable)} className="shrink-0 text-[13px] text-ink hover:underline">
          {asTable ? 'Show chart' : 'Show table'}
        </button>
      </div>
      {asTable ? (
        <table className="w-full text-[15px]">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-1 font-medium">{title}</th>
              <th className="py-1 text-right font-medium">{valueLabel}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {data.map((datum) => (
              <tr key={datum.fullLabel} className="border-b border-line">
                <td className="py-1">{datum.fullLabel}</td>
                <td className="py-1 text-right">
                  {datum.value}
                  {datum.detail && <span className="text-muted"> · {datum.detail}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        children
      )}
    </section>
  )
}

/** Height of the column chart plot area in pixels. */
const PLOT_HEIGHT = 160

/**
 * Vertical column chart with a shared baseline and y-axis gridlines.
 *
 * @param props.data - One column per datum, in order.
 * @param props.unit - Unit for the accessible labels, e.g. `books`.
 */
export function ColumnChart({ data, unit }: { data: ChartDatum[]; unit: string }) {
  const [active, setActive] = useState<number | null>(null)
  const ticks = niceTicks(Math.max(...data.map((datum) => datum.value), 0))
  const top = ticks[ticks.length - 1] ?? 1

  return (
    <div className="flex gap-2">
      {/* Y axis */}
      <div className="relative w-6 shrink-0 text-right text-[13px] tabular-nums text-muted" style={{ height: PLOT_HEIGHT }} aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick} className="absolute right-0" style={{ bottom: `${(tick / top) * 100}%`, transform: 'translateY(50%)' }}>
            {tick}
          </span>
        ))}
      </div>

      <div className="flex-1">
        <div className="relative" style={{ height: PLOT_HEIGHT }}>
          {/* Gridlines (hairline, solid, recessive) */}
          {ticks.map((tick) => (
            <div key={tick} className="absolute inset-x-0 border-t border-line" style={{ bottom: `${(tick / top) * 100}%` }} aria-hidden="true" />
          ))}

          <ul className="absolute inset-0 flex items-end" aria-label={`Chart of ${unit}`}>
            {data.map((datum, index) => (
              <li key={datum.fullLabel} className="relative flex h-full flex-1 items-end justify-center">
                <button
                  type="button"
                  className="flex h-full w-full items-end justify-center outline-none focus-visible:bg-raised"
                  aria-label={`${datum.fullLabel}: ${datum.value} ${unit}${datum.detail ? `, ${datum.detail}` : ''}`}
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                >
                  {datum.value > 0 && (
                    <span
                      className={`block w-full max-w-6 rounded-t bg-accent transition-opacity ${active !== null && active !== index ? 'opacity-50' : ''}`}
                      style={{ height: `${(datum.value / top) * 100}%` }}
                    />
                  )}
                </button>
                {active === index && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-[var(--radius-ui)] bg-accent px-2 py-1 text-[13px] text-on-accent shadow" role="tooltip">
                    <div className="font-medium">{datum.fullLabel}</div>
                    <div>
                      {datum.value} {unit}
                      {datum.detail && ` · ${datum.detail}`}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* X axis labels */}
        <div className="mt-1 flex text-center text-[13px] text-muted" aria-hidden="true">
          {data.map((datum) => (
            <span key={datum.fullLabel} className="flex-1">
              {datum.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Horizontal bar chart with the value printed at each bar's tip.
 *
 * @param props.data - One bar per datum, top to bottom.
 * @param props.unit - Unit for the accessible labels.
 */
export function BarChart({ data, unit }: { data: ChartDatum[]; unit: string }) {
  const max = Math.max(...data.map((datum) => datum.value), 1)
  return (
    <ul className="space-y-2" aria-label={`Chart of ${unit}`}>
      {data.map((datum) => (
        <li key={datum.fullLabel} className="flex items-center gap-3 text-[15px]" title={`${datum.fullLabel}: ${datum.value} ${unit}`}>
          <span className="w-16 shrink-0 text-muted">{datum.label}</span>
          <span className="flex flex-1 items-center gap-2">
            {datum.value > 0 && (
              <span className="block h-4 rounded-r bg-accent" style={{ width: `${(datum.value / max) * 85}%` }} aria-hidden="true" />
            )}
            <span className="tabular-nums text-ink">
              {datum.value}
              <span className="sr-only"> {unit}</span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}
