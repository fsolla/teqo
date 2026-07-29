import { Progress } from '@/components/ui/Progress'
import { formatElectionNumber } from '@/lib/electionFormat'
import type { CampaignHomeSummaryView } from '@/utilities/campaignDashboardData'
import {
  formatGoalCoverageRatioLabel,
  goalCoverageProgressPercent,
} from '@/utilities/municipality/goalCoverage'

export const CampaignHomeSummary = ({ view }: { view: CampaignHomeSummaryView }) => (
  <section aria-label="Resumo da campanha" className="flex flex-col gap-4 pb-4 md:pb-6">
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">Votos estimados</p>
      <p className="text-3xl font-semibold tabular-nums tracking-tight">
        {formatElectionNumber(view.staffVoteTotalCentral)}
      </p>
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
