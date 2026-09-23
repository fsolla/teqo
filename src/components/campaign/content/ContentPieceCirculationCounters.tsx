import {
  CONTENT_PIECE_CIRCULATION_HISTORY_LABEL,
  CONTENT_PIECE_CIRCULATION_METRICS,
  CONTENT_PIECE_CIRCULATION_NEVER_PUBLISHED_LABEL,
  CONTENT_PIECE_CIRCULATION_UNAVAILABLE_LABEL,
  CONTENT_PIECE_CIRCULATION_UNAVAILABLE_VALUE,
  CONTENT_PIECE_CIRCULATION_ZERO_LABEL,
  isContentPieceCirculationEmpty,
  showsContentPieceCirculationHistory,
  type ContentPieceCirculationView,
} from '@/lib/contentPieceCirculation'
import { cn } from '@/lib/utils'

/**
 * C213 — the four anonymous counters of one piece in the internal LIST (table
 * cell) and in the mobile card, ported class-a-class from the approved design:
 * with data they are a labelled grid (4-up in the table, 2×2 in the card); the
 * all-zero piece collapses into the singular sentence; a piece that never
 * entered the public Central says so; and a piece unpublished after circulating
 * keeps its history with the honest subline.
 */

const layoutClasses = {
  list: {
    grid: 'grid grid-cols-4 gap-4',
    cell: '',
    label: 'block text-[10px] text-muted-foreground',
    value: 'mt-1 block text-sm font-semibold tabular-nums',
  },
  card: {
    grid: 'mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border',
    cell: 'bg-card p-3',
    label: 'text-[10px] text-muted-foreground',
    value: 'mt-1 block text-sm font-semibold tabular-nums',
  },
} as const

export const ContentPieceCirculationCounters = ({
  circulation,
  isPublished,
  layout,
}: {
  circulation: ContentPieceCirculationView
  isPublished: boolean
  layout: 'list' | 'card'
}) => {
  const card = layout === 'card'
  const classes = layoutClasses[layout]

  if (circulation.state === 'unavailable') {
    return (
      <p className={cn('text-sm font-semibold text-muted-foreground tabular-nums', card && 'mt-3')}>
        <span className="sr-only">{CONTENT_PIECE_CIRCULATION_UNAVAILABLE_LABEL}</span>
        <span aria-hidden="true">{CONTENT_PIECE_CIRCULATION_UNAVAILABLE_VALUE}</span>
      </p>
    )
  }

  if (circulation.state === 'neverPublished') {
    return (
      <p className={cn('text-xs text-muted-foreground', card && 'mt-3')}>
        {CONTENT_PIECE_CIRCULATION_NEVER_PUBLISHED_LABEL}
      </p>
    )
  }

  if (isContentPieceCirculationEmpty(circulation.counts)) {
    return (
      <p className={cn(card ? 'mt-3 text-xs text-muted-foreground' : 'font-semibold tabular-nums')}>
        {CONTENT_PIECE_CIRCULATION_ZERO_LABEL}
      </p>
    )
  }

  return (
    <>
      <div className={classes.grid}>
        {CONTENT_PIECE_CIRCULATION_METRICS.map((metric) => (
          <div key={metric.key} className={classes.cell}>
            <span className={classes.label}>{metric.label}</span>
            <span className={classes.value}>{circulation.counts[metric.key]}</span>
          </div>
        ))}
      </div>
      {showsContentPieceCirculationHistory(circulation, isPublished) ? (
        <p className={cn('text-[10px] text-muted-foreground', card ? 'mt-2' : 'mt-1.5')}>
          {CONTENT_PIECE_CIRCULATION_HISTORY_LABEL}
        </p>
      ) : null}
    </>
  )
}
