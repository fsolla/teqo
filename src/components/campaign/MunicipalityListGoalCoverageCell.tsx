'use client'

import { useMunicipalityEstimateScenarioOptional } from '@/components/campaign/MunicipalityEstimateScenarioContext'
import {
  formatGoalCoverageDeficitLabel,
  formatGoalCoverageDeficitShortLabel,
  formatGoalCoverageRatioLabel,
  type MunicipalityGoalCoverage,
} from '@/utilities/goalCoverage'
import { DEFAULT_VOTE_ESTIMATE_SCENARIO, type VoteEstimateScenario } from '@/utilities/voteEstimate'

/**
 * E8 "conta da cadeira" list cell: reads the shared scenario picker (same
 * pattern as `MunicipalityListExpectedVotesControl`) and shows the
 * percent + deficit for that scenario, computed server-side for all three.
 *
 * `compact` (desktop table, dense) shows a short signed deficit with the
 * full sentence as a `title` tooltip — same "abbreviate + title" pattern as
 * `StaffMunicipalityVotesDisplay`'s "Nas lideranças" subline — so the column
 * doesn't force a wide `whitespace-nowrap` cell. `default` (mobile cards,
 * more room) spells the sentence out.
 */
export const MunicipalityListGoalCoverageCell = ({
  coverageByScenario,
  layout = 'default',
}: {
  coverageByScenario: Record<VoteEstimateScenario, MunicipalityGoalCoverage>
  layout?: 'default' | 'compact'
}) => {
  const scenarioContext = useMunicipalityEstimateScenarioOptional()
  const activeScenario = scenarioContext?.scenario ?? DEFAULT_VOTE_ESTIMATE_SCENARIO
  const coverage = coverageByScenario[activeScenario]
  const deficitLabel = formatGoalCoverageDeficitLabel(coverage)

  return (
    <div className="flex flex-col items-start">
      <span className="font-medium tabular-nums">{formatGoalCoverageRatioLabel(coverage)}</span>
      {layout === 'compact' ? (
        <span className="text-xs text-muted-foreground tabular-nums" title={deficitLabel}>
          {formatGoalCoverageDeficitShortLabel(coverage)}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground tabular-nums">{deficitLabel}</span>
      )}
    </div>
  )
}
