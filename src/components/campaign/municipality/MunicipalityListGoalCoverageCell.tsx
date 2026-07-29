'use client'

import { useMunicipalityEstimateScenarioOptional } from '@/components/campaign/municipality/MunicipalityEstimateScenarioContext'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  voteEstimateScenarioLabels,
  type VoteEstimateScenario,
} from '@/lib/voteEstimate'
import {
  formatGoalCoverageDeficitLabel,
  formatGoalCoverageDeficitShortLabel,
  formatGoalCoverageRatioLabel,
  type MunicipalityGoalCoverage,
} from '@/utilities/municipality/goalCoverage'

/**
 * E8 "conta da cadeira" list cell: reads the shared scenario picker (same
 * pattern as `MunicipalityListExpectedVotesControl`) and shows the
 * percent + deficit for that scenario, computed server-side for all three.
 *
 * The signed deficit is abbreviated so neither the desktop column forces a wide
 * `whitespace-nowrap` cell nor the mobile card spends two lines on it (B42).
 * The full sentence rides along twice: as a `title` for the mouse (same pattern
 * as `StaffMunicipalityVotesDisplay`'s "Nas lideranças" subline) and as
 * `sr-only` text, because `title` alone reaches neither a screen reader nor a
 * touch device. Sighted touch users read the abbreviation under its `dt` label;
 * the sentence itself is on the detail page's "Conta da cadeira" card.
 */
export const MunicipalityListGoalCoverageCell = ({
  coverageByScenario,
}: {
  coverageByScenario: Record<VoteEstimateScenario, MunicipalityGoalCoverage>
}) => {
  const scenarioContext = useMunicipalityEstimateScenarioOptional()
  const activeScenario = scenarioContext?.scenario ?? DEFAULT_VOTE_ESTIMATE_SCENARIO
  const coverage = coverageByScenario[activeScenario]
  const deficitLabel = formatGoalCoverageDeficitLabel(coverage)
  // Names the scenario the figures belong to: the header sorts by `central`
  // regardless of this picker (E9), so an unnamed number here would be
  // ambiguous the moment the two disagree.
  const scenarioLabel = voteEstimateScenarioLabels[activeScenario]

  return (
    <div className="flex flex-col items-start">
      <span className="font-medium tabular-nums" title={`Cenário ${scenarioLabel}`}>
        {formatGoalCoverageRatioLabel(coverage)}
      </span>
      <span
        aria-hidden="true"
        className="text-xs text-muted-foreground tabular-nums"
        title={`${deficitLabel} (cenário ${scenarioLabel})`}
      >
        {formatGoalCoverageDeficitShortLabel(coverage)}
      </span>
      {/*
       * `title` is a mouse-only channel — never announced reliably, never
       * reachable by touch — so the abbreviation it explains is hidden from
       * assistive tech and the sentence itself is what gets read.
       */}
      <span className="sr-only">{`${deficitLabel} (cenário ${scenarioLabel})`}</span>
    </div>
  )
}
