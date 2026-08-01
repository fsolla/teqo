import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react'

import { Progress } from '@/components/ui/Progress'
import {
  formatHomeSummaryDeltaMagnitude,
  homeSummaryDeltaAriaLabel,
  homeSummaryDeltaPeriodLabel,
  resolveHomeSummaryDeltaDirection,
  shouldShowHomeSummaryDelta,
} from '@/lib/campaignHomeSummaryDelta'
import { formatElectionNumber } from '@/lib/electionFormat'
import { cn } from '@/lib/utils'
import type { CampaignHomeSummaryView } from '@/utilities/campaignDashboardData'
import {
  formatGoalCoverageRatioLabel,
  goalCoverageProgressPercent,
} from '@/utilities/municipality/goalCoverage'

const HomeSummaryDelta = ({ delta }: { delta: number | null }) => {
  if (!shouldShowHomeSummaryDelta(delta)) return null

  const direction = resolveHomeSummaryDeltaDirection(delta)
  const magnitude = formatHomeSummaryDeltaMagnitude(delta)

  return (
    <span
      aria-label={homeSummaryDeltaAriaLabel(delta)}
      className={cn(
        'inline-flex items-center gap-0.5 text-sm font-medium tabular-nums',
        direction === 'up' && 'text-emerald-700 dark:text-emerald-400',
        direction === 'down' && 'text-rose-700 dark:text-rose-400',
      )}
    >
      {direction === 'up' ? <ArrowUpIcon aria-hidden className="size-3.5 shrink-0" /> : null}
      {direction === 'down' ? <ArrowDownIcon aria-hidden className="size-3.5 shrink-0" /> : null}
      <span>{magnitude}</span>
    </span>
  )
}

export const CampaignHomeSummary = ({ view }: { view: CampaignHomeSummaryView }) => (
  <section aria-label="Resumo da campanha" className="flex flex-col gap-4 pb-4 md:pb-6">
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">Votos estimados</p>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-3xl font-semibold tabular-nums tracking-tight">
          {formatElectionNumber(view.staffVoteTotalCentral)}
        </p>
        <HomeSummaryDelta delta={view.homeSummaryDelta} />
      </div>
      {shouldShowHomeSummaryDelta(view.homeSummaryDelta) ? (
        <p className="text-xs text-muted-foreground">{homeSummaryDeltaPeriodLabel}</p>
      ) : null}
    </div>

    <div className="flex max-w-md flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Cobertura por lideranças</span>
        <span className="font-medium tabular-nums">
          {formatGoalCoverageRatioLabel(view.goalCoverage)}
        </span>
      </div>
      {view.goalCoverage.coverageRatio != null ? (
        <Progress
          aria-label={`Cobertura por lideranças: ${formatGoalCoverageRatioLabel(view.goalCoverage)}`}
          className="h-2"
          value={goalCoverageProgressPercent(view.goalCoverage)}
        />
      ) : null}
    </div>
  </section>
)
