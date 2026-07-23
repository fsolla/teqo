import { cn } from '@/lib/utils'
import {
  formatVoteEstimateScenarioAriaLabel,
  VOTE_ESTIMATE_SCENARIOS,
  voteEstimateScenarioLabels,
  type VoteEstimateScenario,
  type VoteEstimateScenarioViewModel,
} from '@/utilities/voteEstimate'

const voteFormatter = new Intl.NumberFormat('pt-BR')

type VoteEstimateScenarioStripProps = {
  values: VoteEstimateScenarioViewModel
  activeScenario?: VoteEstimateScenario
  className?: string
  /** @deprecated Prefer labelMode */
  showLabels?: boolean
  labelMode?: 'all' | 'endpoints' | 'none'
  markerMode?: 'all' | 'active-only'
  stretch?: boolean
}

export const VoteEstimateScenarioStrip = ({
  values,
  activeScenario = 'central',
  className,
  showLabels = true,
  labelMode,
  markerMode = 'all',
  stretch = false,
}: VoteEstimateScenarioStripProps) => {
  const resolvedLabelMode = labelMode ?? (showLabels ? 'all' : 'none')
  const activeOnlyMarkers = markerMode === 'active-only'
  const trackClassName = stretch
    ? 'w-full min-w-0 max-w-none'
    : 'w-full min-w-[4.5rem] max-w-[5.5rem]'
  const filled = VOTE_ESTIMATE_SCENARIOS.map((scenario) => values[scenario]).filter(
    (value): value is number => value != null,
  )
  const min = filled.length > 0 ? Math.min(...filled) : null
  const max = filled.length > 0 ? Math.max(...filled) : null
  const hasSpread = min != null && max != null && max > min
  const activeValue = values[activeScenario]
  const activeMarkerPosition =
    activeValue != null && min != null && max != null
      ? hasSpread
        ? ((activeValue - min) / (max - min)) * 100
        : 50
      : null

  const activeMarker =
    activeMarkerPosition != null ? (
      <span
        title={`${voteEstimateScenarioLabels[activeScenario]}: ${voteFormatter.format(activeValue!)}`}
        className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/45"
        style={{ left: `${activeMarkerPosition}%` }}
      />
    ) : null

  return (
    <div
      className={cn('flex flex-col gap-1', className)}
      role="img"
      aria-label={`Cenários de estimativa: ${formatVoteEstimateScenarioAriaLabel(values)}`}
    >
      {activeOnlyMarkers ? (
        <div className={cn('relative h-1 rounded-full bg-muted', trackClassName)}>
          {activeMarker}
        </div>
      ) : hasSpread ? (
        <div className={cn('relative h-1.5 rounded-full bg-muted', trackClassName)}>
          {VOTE_ESTIMATE_SCENARIOS.map((scenario) => {
            const value = values[scenario]
            if (value == null) return null
            const position = ((value - min) / (max - min)) * 100
            const isActive = scenario === activeScenario
            return (
              <span
                key={scenario}
                title={`${voteEstimateScenarioLabels[scenario]}: ${voteFormatter.format(value)}`}
                className={cn(
                  'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full',
                  isActive ? 'size-2.5 bg-primary ring-2 ring-primary/25' : 'size-2 bg-primary/55',
                )}
                style={{ left: `${position}%` }}
              />
            )
          })}
        </div>
      ) : (
        <div className={cn('flex gap-0.5', trackClassName)}>
          {VOTE_ESTIMATE_SCENARIOS.map((scenario) => {
            const value = values[scenario]
            const isActive = scenario === activeScenario
            return (
              <span
                key={scenario}
                title={
                  value == null
                    ? voteEstimateScenarioLabels[scenario]
                    : `${voteEstimateScenarioLabels[scenario]}: ${voteFormatter.format(value)}`
                }
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  value == null ? 'bg-muted' : isActive ? 'bg-primary' : 'bg-primary/45',
                )}
              />
            )
          })}
        </div>
      )}
      {resolvedLabelMode === 'all' ? (
        <div className="flex justify-between gap-1 text-xs leading-none text-muted-foreground tabular-nums">
          {VOTE_ESTIMATE_SCENARIOS.map((scenario) => {
            const value = values[scenario]
            return (
              <span
                key={scenario}
                className={cn(
                  'min-w-0 truncate',
                  scenario === activeScenario && value != null
                    ? 'font-medium text-foreground'
                    : undefined,
                )}
                title={voteEstimateScenarioLabels[scenario]}
              >
                {value == null ? '·' : voteFormatter.format(value)}
              </span>
            )
          })}
        </div>
      ) : resolvedLabelMode === 'endpoints' ? (
        <div className="flex justify-between gap-2 text-xs leading-none text-muted-foreground tabular-nums">
          <span className="min-w-0 truncate" title={voteEstimateScenarioLabels.pessimistic}>
            {values.pessimistic == null ? '·' : voteFormatter.format(values.pessimistic)}
          </span>
          <span
            className="min-w-0 truncate text-right"
            title={voteEstimateScenarioLabels.optimistic}
          >
            {values.optimistic == null ? '·' : voteFormatter.format(values.optimistic)}
          </span>
        </div>
      ) : null}
    </div>
  )
}
