import type { ReactNode } from 'react'

import {
  CONTENT_PIECE_CIRCULATION_DETAIL_INTRO,
  CONTENT_PIECE_CIRCULATION_HISTORY_BODY,
  CONTENT_PIECE_CIRCULATION_HISTORY_TITLE,
  CONTENT_PIECE_CIRCULATION_METRICS,
  CONTENT_PIECE_CIRCULATION_NEVER_PUBLISHED_BODY,
  CONTENT_PIECE_CIRCULATION_NEVER_PUBLISHED_TITLE,
  CONTENT_PIECE_CIRCULATION_PRIVACY,
  CONTENT_PIECE_CIRCULATION_READING,
  CONTENT_PIECE_CIRCULATION_UNAVAILABLE_BODY,
  CONTENT_PIECE_CIRCULATION_UNAVAILABLE_TITLE,
  CONTENT_PIECE_CIRCULATION_UNAVAILABLE_VALUE,
  CONTENT_PIECE_CIRCULATION_UNAVAILABLE_VALUE_LABEL,
  isContentPieceCirculationEmpty,
  showsContentPieceCirculationHistory,
  type ContentPieceCirculationMetric,
  type ContentPieceCirculationView,
} from '@/lib/contentPieceCirculation'
import { cn } from '@/lib/utils'

/**
 * C213 — the "Circulação" block of the piece ficha (approved design scenes
 * 02/05/06/07): four absolute counters in the ported responsive grid, then the
 * honest state — never published, historical after unpublishing, or counting
 * unavailable — then "Leitura:" (only when there are counters to compare) and
 * the privacy line. The form follows below.
 */

const noteClasses = 'rounded-lg bg-muted text-muted-foreground'
const notePaddingClasses = 'p-3 text-xs leading-5 sm:p-4 sm:text-sm sm:leading-6'

/** Cells 2–4 carry the grid's separators (design's port contract). */
const cellDividerClasses = [
  undefined,
  'sm:border-l',
  'sm:border-t lg:border-l lg:border-t-0',
  'sm:border-l sm:border-t lg:border-t-0',
] as const

const metricStrip = (
  renderValue: (metric: ContentPieceCirculationMetric) => ReactNode,
): ReactNode => (
  <dl className="mt-5 grid grid-cols-1 divide-y overflow-hidden rounded-xl border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
    {CONTENT_PIECE_CIRCULATION_METRICS.map((metric, index) => (
      <div
        key={metric.key}
        className={cn(
          'flex min-w-0 items-center justify-between gap-4 p-4 sm:flex-col sm:items-start sm:justify-start sm:gap-1',
          cellDividerClasses[index],
        )}
      >
        <dt className="text-sm font-medium text-muted-foreground sm:text-xs">
          {metric.detailLabel}
        </dt>
        {renderValue(metric)}
      </div>
    ))}
  </dl>
)

const unavailableStrip = metricStrip((metric) => (
  <dd
    className="text-lg font-medium tabular-nums tracking-tight"
    aria-label={`${metric.detailLabel}: ${CONTENT_PIECE_CIRCULATION_UNAVAILABLE_VALUE_LABEL}`}
  >
    <span aria-hidden="true">{CONTENT_PIECE_CIRCULATION_UNAVAILABLE_VALUE}</span>
  </dd>
))

const countersStrip = (view: Extract<ContentPieceCirculationView, { state: 'data' }>) =>
  metricStrip((metric) => (
    <dd className="text-lg font-medium tabular-nums tracking-tight">{view.counts[metric.key]}</dd>
  ))

export const ContentPieceCirculationPanel = ({
  circulation,
  isPublished,
}: {
  circulation: ContentPieceCirculationView
  isPublished: boolean
}) => {
  const hasCounters =
    circulation.state === 'data' && !isContentPieceCirculationEmpty(circulation.counts)

  return (
    <section aria-label="Circulação da peça">
      <h3 className="text-base font-semibold">Circulação</h3>
      <p className="mt-1 text-sm text-muted-foreground">{CONTENT_PIECE_CIRCULATION_DETAIL_INTRO}</p>

      {circulation.state === 'unavailable' ? (
        <>
          {unavailableStrip}
          <p role="status" className={cn('mt-4', notePaddingClasses, noteClasses)}>
            <b className="text-foreground">{CONTENT_PIECE_CIRCULATION_UNAVAILABLE_TITLE}</b>{' '}
            {CONTENT_PIECE_CIRCULATION_UNAVAILABLE_BODY}
          </p>
        </>
      ) : circulation.state === 'neverPublished' ? (
        <div className="mt-5 rounded-xl border bg-muted/40 p-5">
          <p className="text-sm font-semibold">{CONTENT_PIECE_CIRCULATION_NEVER_PUBLISHED_TITLE}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {CONTENT_PIECE_CIRCULATION_NEVER_PUBLISHED_BODY}
          </p>
        </div>
      ) : (
        <>
          {countersStrip(circulation)}
          {showsContentPieceCirculationHistory(circulation, isPublished) ? (
            <p className={cn('mt-4', notePaddingClasses, noteClasses)}>
              <b className="text-foreground">{CONTENT_PIECE_CIRCULATION_HISTORY_TITLE}</b>{' '}
              {CONTENT_PIECE_CIRCULATION_HISTORY_BODY}
            </p>
          ) : null}
        </>
      )}

      {hasCounters ? (
        <aside
          aria-label="Como ler os contadores"
          className={cn('mt-5', notePaddingClasses, noteClasses)}
        >
          <b className="text-foreground">Leitura:</b> {CONTENT_PIECE_CIRCULATION_READING}
        </aside>
      ) : null}

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        <span className="font-medium text-foreground">Privacidade:</span>{' '}
        {CONTENT_PIECE_CIRCULATION_PRIVACY}
      </p>
    </section>
  )
}
