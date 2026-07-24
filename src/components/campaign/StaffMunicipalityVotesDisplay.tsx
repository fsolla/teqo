import { UsersIcon } from 'lucide-react'

import { VoteEstimateScenarioStrip } from '@/components/campaign/VoteEstimateScenarioStrip'
import { cn } from '@/lib/utils'
import {
  formatVoteEstimateScenarioAriaLabel,
  getVoteEstimateForScenario,
  hasAnyVoteEstimate,
  type VoteEstimateScenario,
  type VoteEstimateScenarioViewModel,
} from '@/utilities/voteEstimate'
import type { MunicipalityPledgeCoverageView } from '@/utilities/votePledgeData'

const voteFormatter = new Intl.NumberFormat('pt-BR')

const pledgeCoverageSubline = (
  coverage: MunicipalityPledgeCoverageView | null | undefined,
): number | null => {
  if (!coverage || coverage.pledgeCount === 0) return null
  if (coverage.missingEstimateCount === coverage.pledgeCount) return null
  return coverage.effectiveTotal > 0 ? coverage.effectiveTotal : null
}

export const StaffMunicipalityVotesDisplay = ({
  expectedVotes,
  pledgeCoverage,
  activeScenario = 'central',
  layout = 'default',
  align = 'start',
  suppressHoverPreview = false,
  valueClassName = 'text-lg font-medium tabular-nums',
}: {
  expectedVotes: VoteEstimateScenarioViewModel
  pledgeCoverage?: MunicipalityPledgeCoverageView | null
  activeScenario?: VoteEstimateScenario
  layout?: 'default' | 'compact'
  align?: 'start' | 'center'
  suppressHoverPreview?: boolean
  valueClassName?: string
}) => {
  const displayValue = getVoteEstimateForScenario(expectedVotes, activeScenario)
  const leadershipTotal = pledgeCoverageSubline(pledgeCoverage)
  const hasEstimate = hasAnyVoteEstimate(expectedVotes)
  const isCompact = layout === 'compact'

  if (isCompact) {
    return (
      <>
        <span
          className={cn(
            'tabular-nums',
            displayValue == null ? 'text-muted-foreground' : valueClassName,
          )}
        >
          {displayValue == null ? '—' : voteFormatter.format(displayValue)}
        </span>
        {hasEstimate && !suppressHoverPreview ? (
          <div
            className={cn(
              'pointer-events-none absolute top-full z-20 mt-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
              align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0',
            )}
          >
            <div className="rounded-md border bg-popover px-2 py-1.5 shadow-sm">
              <VoteEstimateScenarioStrip
                values={expectedVotes}
                activeScenario={activeScenario}
                labelMode="endpoints"
                markerMode="active-only"
              />
            </div>
          </div>
        ) : null}
        <span className="sr-only">{formatVoteEstimateScenarioAriaLabel(expectedVotes)}</span>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {displayValue == null ? (
        <span className={cn('text-muted-foreground', valueClassName)}>—</span>
      ) : (
        <span className={valueClassName}>{voteFormatter.format(displayValue)}</span>
      )}
      {hasEstimate ? (
        <VoteEstimateScenarioStrip
          values={expectedVotes}
          activeScenario={activeScenario}
          className="max-w-[12rem]"
        />
      ) : null}
      {leadershipTotal != null ? (
        <span
          className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground tabular-nums"
          title={`Nas lideranças: ${voteFormatter.format(leadershipTotal)}`}
        >
          <UsersIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="sr-only">Nas lideranças:</span>
          {voteFormatter.format(leadershipTotal)}
        </span>
      ) : null}
    </div>
  )
}
